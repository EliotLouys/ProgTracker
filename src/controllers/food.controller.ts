import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { fetchOFFProduct } from "../services/openfoodfacts.service";

export const getByBarcode = async (req: Request, res: Response) => {
  const product = await fetchOFFProduct(req.params.code);
  product ? res.json(product) : res.status(404).json({ error: "Not found" });
};

export const searchCiqual = async (req: Request, res: Response) => {
  const results = await prisma.ciqualItem.findMany({
    where: { name: { contains: req.query.q as string, mode: "insensitive" } },
    take: 10,
  });
  res.json(results);
};
