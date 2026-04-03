"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivities = exports.getDashboard = void 0;
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
const getActivities = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    const activities = await prisma_1.prisma.activity.findMany({
        where: { userId: req.userId },
        orderBy: { startDate: "desc" },
        take: 100,
    });
    res.json(activities.map((activity) => ({
        id: Number(activity.id),
        name: activity.name,
        distance: activity.distance,
        moving_time: activity.movingTime,
        total_elevation_gain: 0,
        start_date: activity.startDate.toISOString(),
        type: activity.type,
        calories: activity.calories,
    })));
};
exports.getActivities = getActivities;
