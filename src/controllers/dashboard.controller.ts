import { Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../lib/prisma";
import * as dashboardService from "../services/dashboard.service";

export const getDashboard = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  const { startDate, endDate, sport, excludeFuture } = req.query;

  try {
    const stats = await dashboardService.getDashboardStats(
      req.userId,
      startDate as string,
      endDate as string,
      sport as string,
      excludeFuture === 'true'
    );
    return res.json(stats);
  } catch (error: any) {
    console.error("[DashboardController] Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
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