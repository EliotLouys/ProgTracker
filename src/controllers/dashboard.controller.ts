import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../lib/prisma";

export const getDashboard = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  const activities = await prisma.activity.aggregate({
    where: { userId: req.userId },
    _sum: { calories: true },
  });
  const meals = await prisma.mealLog.aggregate({
    where: { userId: req.userId },
    _sum: { totalCalories: true },
  });
  res.json({
    burned: activities._sum.calories || 0,
    consumed: meals._sum.totalCalories || 0,
    net: (meals._sum.totalCalories || 0) - (activities._sum.calories || 0),
  });
};

export const getActivities = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);

  const activities = await prisma.activity.findMany({
    where: { userId: req.userId },
    orderBy: { startDate: "desc" },
    take: 100,
  });

  res.json(
    activities.map((activity) => ({
      id: Number(activity.id),
      name: activity.name,
      distance: activity.distance,
      moving_time: activity.movingTime,
      total_elevation_gain: 0,
      start_date: activity.startDate.toISOString(),
      type: activity.type,
      calories: activity.calories,
    })),
  );
};
