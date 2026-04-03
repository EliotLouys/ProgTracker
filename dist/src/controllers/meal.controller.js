"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMeal = void 0;
const prisma_1 = require("../lib/prisma");
const logMeal = async (req, res) => {
    const { name, kcalPer100g, quantityGrams, source, externalId } = req.body;
    if (!req.userId)
        return res.sendStatus(401);
    const meal = await prisma_1.prisma.mealLog.create({
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
exports.logMeal = logMeal;
