import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import {
  fetchOFFProduct,
  searchOFFProducts,
} from "../services/openfoodfacts.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { Recipe, RecipeIngredient, CiqualItem, CustomFood } from "@prisma/client";

type RecipeWithIngredients = Recipe & { ingredients: RecipeIngredient[] };

interface OFFProduct {
  externalId: string;
  name: string;
  kcalPer100g: number;
  proteins: number | null;
  carbs: number | null;
  fats: number | null;
  source: string;
}

export const getByBarcode = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  const { code } = req.params;

  try {
    // 1. Check shadow database (CustomFood) first
    const existing = await prisma.customFood.findFirst({
      where: { userId: req.userId, barcode: code },
    });

    if (existing) {
      return res.json({ ...existing, source: "USER_FOOD" });
    }

    // 2. Fetch from Open Food Facts
    const product = await fetchOFFProduct(code);
    if (!product) return res.status(404).json({ error: "Not found" });

    // 3. Save to shadow database for next time
    const saved = await prisma.customFood.create({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const searchFood = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  const q = (req.query.q as string) || "";
  const includeRecipes = req.query.recipes === "true";

  try {
    const [ciqualResults, customResults, recipeResults, openFoodFactsResult] =
      await Promise.all([
        prisma.ciqualItem.findMany({
          where: { name: { contains: q, mode: "insensitive" } },
          take: 10,
        }),
        prisma.customFood.findMany({
          where: {
            userId: req.userId,
            name: { contains: q, mode: "insensitive" },
          },
          take: 10,
        }),
        includeRecipes
          ? prisma.recipe.findMany({
              where: {
                userId: req.userId,
                name: { contains: q, mode: "insensitive" },
              },
              take: 10,
            })
          : (Promise.resolve([]) as Promise<Recipe[]>),
        searchOFFProducts(q) as Promise<OFFProduct[]>,
      ]);

    // Remove duplicates from OFF that are already in custom foods (via barcode)
    const customBarcodes = new Set(
      customResults.map((c: CustomFood) => c.barcode).filter(Boolean),
    );
    const filteredOFF = openFoodFactsResult.filter(
      (off: OFFProduct) => !customBarcodes.has(off.externalId),
    );

    const results = [
      ...customResults.map((i: CustomFood) => ({
        externalId: i.id,
        name: i.name,
        kcalPer100g: i.kcalPer100g,
        proteins: i.proteins,
        carbs: i.carbs,
        fats: i.fats,
        source: "USER_FOOD" as const,
      })),
      ...recipeResults.map((i: Recipe) => ({
        externalId: i.id,
        name: i.name,
        kcalPer100g: i.kcalPer100g,
        proteins: i.proteins,
        carbs: i.carbs,
        fats: i.fats,
        source: "RECIPE" as const,
      })),
      ...ciqualResults.map((i: CiqualItem) => ({
        externalId: String(i.id),
        name: i.name,
        kcalPer100g: i.kcalPer100g,
        proteins: i.proteins,
        carbs: i.carbs,
        fats: i.fats,
        source: "CIQUAL" as const,
      })),
      ...filteredOFF.map((i: OFFProduct) => ({
        externalId: i.externalId,
        name: i.name,
        kcalPer100g: i.kcalPer100g,
        proteins: i.proteins,
        carbs: i.carbs,
        fats: i.fats,
        source: "OPEN_FOOD_FACTS" as const,
      })),
    ];

    res.json(results);
  } catch (error: any) {
    console.error("Search error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const listRecipes = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  try {
    const recipes = await prisma.recipe.findMany({
      where: { userId: req.userId },
      include: { ingredients: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(recipes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

interface IngredientInput {
  name: string;
  kcalPer100g: number;
  proteins?: number;
  carbs?: number;
  fats?: number;
  quantityGrams: number;
}

export const createRecipe = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  try {
    const { name, ingredients } = req.body as { name: string; ingredients: IngredientInput[] };

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

    const recipe = await prisma.recipe.create({
      data: {
        userId: req.userId,
        name,
        kcalPer100g,
        proteins,
        carbs,
        fats,
        ingredients: {
          create: ingredients,
        },
      },
      include: { ingredients: true },
    });
    res.status(201).json(recipe);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteRecipe = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  try {
    const { id } = req.params;
    await prisma.recipe.delete({
      where: { id, userId: req.userId },
    });
    res.sendStatus(204);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const listCustomFoods = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  try {
    const foods = await prisma.customFood.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(foods);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createCustomFood = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  try {
    const { name, kcalPer100g, proteins, carbs, fats, barcode } = req.body;

    const food = await prisma.customFood.create({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCustomFood = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  try {
    const { id } = req.params;
    await prisma.customFood.delete({
      where: { id, userId: req.userId },
    });
    res.sendStatus(204);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
