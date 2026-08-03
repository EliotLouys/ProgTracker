"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMeal = exports.getMeals = exports.logMeal = void 0;
const prisma_1 = require("../lib/prisma");
const logMeal = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    try {
        const { name, kcalPer100g, proteins, carbs, fats, quantityGrams, source, externalId, mealType, consumedAt } = req.body;
        const meal = await prisma_1.prisma.mealLog.create({
            data: {
                userId: req.userId,
                name,
                source,
                externalId: externalId ? String(externalId) : null,
                quantityGrams,
                totalCalories: (kcalPer100g * quantityGrams) / 100,
                proteins: proteins ? (proteins * quantityGrams) / 100 : null,
                carbs: carbs ? (carbs * quantityGrams) / 100 : null,
                fats: fats ? (fats * quantityGrams) / 100 : null,
                mealType: mealType || "SNACK",
                consumedAt: consumedAt ? new Date(consumedAt) : new Date(),
            },
        });
        res.status(201).json(meal);
    }
    catch (error) {
        console.error("Log meal error:", error);
        res.status(500).json({ error: error.message });
    }
};
exports.logMeal = logMeal;
const getMeals = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    try {
        const { date, startDate, endDate } = req.query;
        let startRange;
        let endRange;
        if (startDate && endDate) {
            startRange = new Date(startDate);
            endRange = new Date(endDate);
        }
        else if (date) {
            // On force l'interprétation en date locale (YYYY, MM-1, DD)
            const [y, m, d] = date.split('-').map(Number);
            startRange = new Date(y, m - 1, d, 0, 0, 0, 0);
            endRange = new Date(startRange);
            endRange.setHours(23, 59, 59, 999);
        }
        else {
            startRange = new Date();
            startRange.setHours(0, 0, 0, 0);
            endRange = new Date(startRange);
            endRange.setHours(23, 59, 59, 999);
        }
        const meals = await prisma_1.prisma.mealLog.findMany({
            where: {
                userId: req.userId,
                consumedAt: {
                    gte: startRange,
                    lte: endRange,
                },
            },
            orderBy: { consumedAt: "asc" },
        });
        res.json(meals);
    }
    catch (error) {
        console.error("Get meals error:", error);
        res.status(500).json({ error: error.message });
    }
};
exports.getMeals = getMeals;
const deleteMeal = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    try {
        const { id } = req.params;
        const existing = await prisma_1.prisma.mealLog.findFirst({
            where: { id, userId: req.userId },
        });
        if (!existing)
            return res.status(404).json({ error: "Meal not found" });
        await prisma_1.prisma.mealLog.delete({
            where: { id },
        });
        res.sendStatus(204);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteMeal = deleteMeal;
