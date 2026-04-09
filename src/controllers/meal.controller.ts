import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../lib/prisma";

export const logMeal = async (req: AuthRequest, res: Response) => {
  const { name, kcalPer100g, quantityGrams, source, externalId, mealType, consumedAt } = req.body;
  if (!req.userId) return res.sendStatus(401);
  const meal = await prisma.mealLog.create({
    data: {
      userId: req.userId,
      name,
      source,
      externalId: externalId ? String(externalId) : null,
      quantityGrams,
      totalCalories: (kcalPer100g * quantityGrams) / 100,
      mealType: mealType || "SNACK",
      consumedAt: consumedAt ? new Date(consumedAt) : new Date(),
    },
  });
  res.status(201).json(meal);
};

export const getMeals = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  const { date, startDate, endDate } = req.query;
  
  let startRange: Date;
  let endRange: Date;

  if (startDate && endDate) {
    startRange = new Date(startDate as string);
    endRange = new Date(endDate as string);
  } else if (date) {
    // On force l'interprétation en date locale (YYYY, MM-1, DD)
    const [y, m, d] = (date as string).split('-').map(Number);
    startRange = new Date(y, m - 1, d, 0, 0, 0, 0);
    endRange = new Date(startRange);
    endRange.setHours(23, 59, 59, 999);
  } else {
    startRange = new Date();
    startRange.setHours(0, 0, 0, 0);
    endRange = new Date(startRange);
    endRange.setHours(23, 59, 59, 999);
  }

  const meals = await prisma.mealLog.findMany({
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
};

export const deleteMeal = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  const { id } = req.params;
  await prisma.mealLog.delete({
    where: { id, userId: req.userId },
  });
  res.sendStatus(204);
};
