"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboard = void 0;
const prisma_1 = require("../lib/prisma");
const getDashboard = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    const activities = await prisma_1.prisma.activity.aggregate({
        where: { userId: req.userId },
        _sum: { calories: true },
    });
    const meals = await prisma_1.prisma.mealLog.aggregate({
        where: { userId: req.userId },
        _sum: { totalCalories: true },
    });
    res.json({
        burned: activities._sum.calories || 0,
        consumed: meals._sum.totalCalories || 0,
        net: (meals._sum.totalCalories || 0) - (activities._sum.calories || 0),
    });
};
exports.getDashboard = getDashboard;
