"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRecipe = exports.updateCustomFood = exports.createCustomFood = exports.listCustomFoods = exports.deleteCustomFood = exports.deleteRecipe = exports.createRecipe = exports.listRecipes = exports.searchFood = exports.getByBarcode = void 0;
const prisma_1 = require("../lib/prisma");
const openfoodfacts_service_1 = require("../services/openfoodfacts.service");
const getByBarcode = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    const { code } = req.params;
    try {
        // 1. Check shadow database (CustomFood) first
        const existing = await prisma_1.prisma.customFood.findFirst({
            where: { userId: req.userId, barcode: code },
        });
        if (existing) {
            return res.json({ ...existing, source: "USER_FOOD" });
        }
        // 2. Fetch from Open Food Facts
        const product = await (0, openfoodfacts_service_1.fetchOFFProduct)(code);
        if (!product)
            return res.status(404).json({ error: "Not found" });
        // 3. Save to shadow database for next time
        const saved = await prisma_1.prisma.customFood.create({
            data: {
                userId: req.userId,
                name: product.name,
                barcode: code,
                kcalPer100g: product.kcalPer100g,
                proteins: product.proteins,
                carbs: product.carbs,
                fats: product.fats,
            },
        });
        res.json({ ...saved, source: "USER_FOOD" });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getByBarcode = getByBarcode;
const searchFood = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    const q = req.query.q || "";
    const includeRecipes = req.query.recipes === "true";
    const page = parseInt(req.query.page) || 1;
    const take = 10;
    const skip = (page - 1) * take;
    try {
        const [ciqualResults, customResults, recipeResults, openFoodFactsResult] = await Promise.all([
            prisma_1.prisma.ciqualItem.findMany({
                where: { name: { contains: q, mode: "insensitive" } },
                skip,
                take,
            }),
            prisma_1.prisma.customFood.findMany({
                where: {
                    userId: req.userId,
                    name: { contains: q, mode: "insensitive" },
                },
                skip,
                take,
            }),
            includeRecipes
                ? prisma_1.prisma.recipe.findMany({
                    where: {
                        userId: req.userId,
                        name: { contains: q, mode: "insensitive" },
                    },
                    skip,
                    take,
                })
                : Promise.resolve([]),
            (0, openfoodfacts_service_1.searchOFFProducts)(q, page),
        ]);
        // Remove duplicates from OFF that are already in custom foods (via barcode)
        const customBarcodes = new Set(customResults.map((c) => c.barcode).filter(Boolean));
        const filteredOFF = openFoodFactsResult.filter((off) => !customBarcodes.has(off.externalId));
        const results = [
            ...customResults.map((i) => ({
                externalId: i.id,
                name: i.name,
                kcalPer100g: i.kcalPer100g,
                proteins: i.proteins,
                carbs: i.carbs,
                fats: i.fats,
                source: "USER_FOOD",
            })),
            ...recipeResults.map((i) => ({
                externalId: i.id,
                name: i.name,
                kcalPer100g: i.kcalPer100g,
                proteins: i.proteins,
                carbs: i.carbs,
                fats: i.fats,
                source: "RECIPE",
            })),
            ...ciqualResults.map((i) => ({
                externalId: String(i.id),
                name: i.name,
                kcalPer100g: i.kcalPer100g,
                proteins: i.proteins,
                carbs: i.carbs,
                fats: i.fats,
                source: "CIQUAL",
            })),
            ...filteredOFF.map((i) => ({
                externalId: i.externalId,
                name: i.name,
                kcalPer100g: i.kcalPer100g,
                proteins: i.proteins,
                carbs: i.carbs,
                fats: i.fats,
                source: "OPEN_FOOD_FACTS",
            })),
        ];
        res.json(results);
    }
    catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ error: error.message });
    }
};
exports.searchFood = searchFood;
const listRecipes = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    try {
        const recipes = await prisma_1.prisma.recipe.findMany({
            where: { userId: req.userId },
            include: { ingredients: true },
            orderBy: { createdAt: "desc" },
        });
        res.json(recipes);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.listRecipes = listRecipes;
const createRecipe = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    try {
        const { name, ingredients } = req.body;
        // Calculate overall nutrition per 100g of the recipe
        let totalKcal = 0;
        let totalProteins = 0;
        let totalCarbs = 0;
        let totalFats = 0;
        let totalWeight = 0;
        for (const ing of ingredients) {
            const weight = parseFloat(String(ing.quantityGrams)) || 0;
            totalWeight += weight;
            totalKcal += (ing.kcalPer100g * weight) / 100;
            totalProteins += ((ing.proteins || 0) * weight) / 100;
            totalCarbs += ((ing.carbs || 0) * weight) / 100;
            totalFats += ((ing.fats || 0) * weight) / 100;
        }
        const kcalPer100g = totalWeight > 0 ? (totalKcal / totalWeight) * 100 : 0;
        const proteins = totalWeight > 0 ? (totalProteins / totalWeight) * 100 : 0;
        const carbs = totalWeight > 0 ? (totalCarbs / totalWeight) * 100 : 0;
        const fats = totalWeight > 0 ? (totalFats / totalWeight) * 100 : 0;
        const recipe = await prisma_1.prisma.recipe.create({
            data: {
                userId: req.userId,
                name,
                kcalPer100g,
                proteins,
                carbs,
                fats,
                ingredients: {
                    create: ingredients.map((ing) => ({
                        name: ing.name,
                        kcalPer100g: parseFloat(String(ing.kcalPer100g)) || 0,
                        proteins: ing.proteins !== undefined && ing.proteins !== null ? parseFloat(String(ing.proteins)) : null,
                        carbs: ing.carbs !== undefined && ing.carbs !== null ? parseFloat(String(ing.carbs)) : null,
                        fats: ing.fats !== undefined && ing.fats !== null ? parseFloat(String(ing.fats)) : null,
                        quantityGrams: parseFloat(String(ing.quantityGrams)) || 0,
                    })),
                },
            },
            include: { ingredients: true },
        });
        res.status(201).json(recipe);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createRecipe = createRecipe;
const deleteRecipe = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    try {
        const { id } = req.params;
        await prisma_1.prisma.recipe.delete({
            where: { id, userId: req.userId },
        });
        res.sendStatus(204);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteRecipe = deleteRecipe;
const deleteCustomFood = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    try {
        const { id } = req.params;
        await prisma_1.prisma.customFood.delete({
            where: { id, userId: req.userId },
        });
        res.sendStatus(204);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteCustomFood = deleteCustomFood;
const listCustomFoods = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    try {
        const foods = await prisma_1.prisma.customFood.findMany({
            where: { userId: req.userId },
            orderBy: { createdAt: "desc" },
        });
        res.json(foods);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.listCustomFoods = listCustomFoods;
const createCustomFood = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    try {
        const { name, kcalPer100g, proteins, carbs, fats, barcode } = req.body;
        const food = await prisma_1.prisma.customFood.create({
            data: {
                userId: req.userId,
                name,
                barcode,
                kcalPer100g: parseFloat(kcalPer100g) || 0,
                proteins: proteins ? parseFloat(proteins) : null,
                carbs: carbs ? parseFloat(carbs) : null,
                fats: fats ? parseFloat(fats) : null,
            },
        });
        res.status(201).json(food);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createCustomFood = createCustomFood;
const updateCustomFood = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    try {
        const { id } = req.params;
        const { name, kcalPer100g, proteins, carbs, fats, barcode } = req.body;
        const food = await prisma_1.prisma.customFood.update({
            where: { id, userId: req.userId },
            data: {
                name,
                barcode,
                kcalPer100g: parseFloat(kcalPer100g) || 0,
                proteins: proteins !== undefined ? parseFloat(proteins) : null,
                carbs: carbs !== undefined ? parseFloat(carbs) : null,
                fats: fats !== undefined ? parseFloat(fats) : null,
            },
        });
        res.json(food);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateCustomFood = updateCustomFood;
const updateRecipe = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    try {
        const { id } = req.params;
        const { name, ingredients } = req.body;
        // Calculate overall nutrition per 100g of the recipe
        let totalKcal = 0;
        let totalProteins = 0;
        let totalCarbs = 0;
        let totalFats = 0;
        let totalWeight = 0;
        for (const ing of ingredients) {
            const weight = parseFloat(String(ing.quantityGrams)) || 0;
            totalWeight += weight;
            totalKcal += (ing.kcalPer100g * weight) / 100;
            totalProteins += ((ing.proteins || 0) * weight) / 100;
            totalCarbs += ((ing.carbs || 0) * weight) / 100;
            totalFats += ((ing.fats || 0) * weight) / 100;
        }
        const kcalPer100g = totalWeight > 0 ? (totalKcal / totalWeight) * 100 : 0;
        const proteins = totalWeight > 0 ? (totalProteins / totalWeight) * 100 : 0;
        const carbs = totalWeight > 0 ? (totalCarbs / totalWeight) * 100 : 0;
        const fats = totalWeight > 0 ? (totalFats / totalWeight) * 100 : 0;
        // Update the recipe: delete old ingredients and create new ones (simplest approach)
        const recipe = await prisma_1.prisma.recipe.update({
            where: { id, userId: req.userId },
            data: {
                name,
                kcalPer100g,
                proteins,
                carbs,
                fats,
                ingredients: {
                    deleteMany: {},
                    create: ingredients.map((ing) => ({
                        name: ing.name,
                        kcalPer100g: parseFloat(String(ing.kcalPer100g)) || 0,
                        proteins: ing.proteins !== undefined && ing.proteins !== null ? parseFloat(String(ing.proteins)) : null,
                        carbs: ing.carbs !== undefined && ing.carbs !== null ? parseFloat(String(ing.carbs)) : null,
                        fats: ing.fats !== undefined && ing.fats !== null ? parseFloat(String(ing.fats)) : null,
                        quantityGrams: parseFloat(String(ing.quantityGrams)) || 0,
                    })),
                },
            },
            include: { ingredients: true },
        });
        res.json(recipe);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateRecipe = updateRecipe;
