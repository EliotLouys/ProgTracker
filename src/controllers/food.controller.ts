import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { fetchOFFProduct } from "../services/openfoodfacts.service";
import { AuthRequest } from "../middlewares/auth.middleware";

export const getByBarcode = async (req: Request, res: Response) => {
  const product = await fetchOFFProduct(req.params.code);
  product ? res.json(product) : res.status(404).json({ error: "Not found" });
};

export const searchFood = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  const q = req.query.q as string;

  const [ciqualResults, customResults] = await Promise.all([
    prisma.ciqualItem.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: 10,
    }),
    prisma.customFood.findMany({
      where: { 
        userId: req.userId,
        name: { contains: q, mode: "insensitive" } 
      },
      take: 10,
    })
  ]);

  const results = [
    ...customResults.map(i => ({ ...i, source: "USER_FOOD" })),
    ...ciqualResults.map(i => ({ ...i, source: "CIQUAL" }))
  ];

  res.json(results);
};

export const listCustomFoods = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  const foods = await prisma.customFood.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "desc" },
  });
  res.json(foods);
};

export const createCustomFood = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  const { name, kcalPer100g, proteins, carbs, fats } = req.body;
  
  const food = await prisma.customFood.create({
    data: {
      userId: req.userId,
      name,
      kcalPer100g: parseFloat(kcalPer100g) || 0,
      proteins: proteins ? parseFloat(proteins) : null,
      carbs: carbs ? parseFloat(carbs) : null,
      fats: fats ? parseFloat(fats) : null,
    },
  });
  res.status(201).json(food);
};

export const deleteCustomFood = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  const { id } = req.params;
  
  await prisma.customFood.delete({
    where: { id, userId: req.userId },
  });
  res.sendStatus(204);
};
