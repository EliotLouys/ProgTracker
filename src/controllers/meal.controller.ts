import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../lib/prisma";

export const logMeal = async (req: AuthRequest, res: Response) => {
  const { name, kcalPer100g, quantityGrams, source, externalId } = req.body;
  if (!req.userId) return res.sendStatus(401);
  const meal = await prisma.mealLog.create({
    data: {
      userId: req.userId,
      name,
      source,
      externalId: String(externalId),
      quantityGrams,
      totalCalories: (kcalPer100g * quantityGrams) / 100,
    },
  });
  res.status(201).json(meal);
};
