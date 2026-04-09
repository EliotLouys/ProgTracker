import { prisma } from "../lib/prisma";

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  SEDENTARY: 1.2,
  LIGHTLY_ACTIVE: 1.375,
  MODERATELY_ACTIVE: 1.55,
  VERY_ACTIVE: 1.725,
  EXTRA_ACTIVE: 1.9,
};

const calculateDailyBMR = (user: any) => {
  if (!user.weightKg || !user.heightCm || !user.age) return 2000;
  let bmr = 10 * user.weightKg + 6.25 * user.heightCm - 5 * user.age;
  if (user.gender === "MALE") bmr += 5;
  else bmr -= 161;
  return bmr;
};

const calculateHourlyNaturalBurn = (user: any) => {
  const bmr = calculateDailyBMR(user);
  const multiplier = ACTIVITY_MULTIPLIERS[user.activityLevel || "SEDENTARY"];
  return (bmr * multiplier) / 24;
};

export const getDashboardStats = async (userId: string, startDate?: string, endDate?: string, sport?: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const hourlyNaturalBurn = calculateHourlyNaturalBurn(user);

  // Normalisation des dates pour couvrir toute la journée du début à la fin
  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(0, 0, 0, 0);
  
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  // Debug: voir ce qu'on demande
  console.log(`[DashboardService] Query range: ${start.toISOString()} to ${end.toISOString()}`);

  // Types Strava
  const getSportTypes = (s: any): string[] | undefined => {
    if (!s || s === "all") return undefined;
    if (s === "Ride") return ["Ride", "EBikeRide", "VirtualRide"];
    if (s === "Workout") return ["Workout", "WeightTraining", "Crossfit", "Weightlifting", "Yoga"];
    if (s === "Run") return ["Run", "VirtualRun"];
    if (s === "Walk") return ["Walk"];
    return [s];
  };

  const selectedTypes = getSportTypes(sport);

  // 1. Récupérer TOUTES les activités de l'utilisateur (sans filtre de date d'abord pour debug si besoin, 
  // mais restons sur le filtre en étant plus large)
  const allActivities = await prisma.activity.findMany({
    where: { 
      userId, 
      startDate: { 
        gte: start, 
        lte: end 
      } 
    }
  });

  console.log(`[DashboardService] Found ${allActivities.length} total activities in DB for this range.`);
  if (allActivities.length > 0) {
    console.log(`[DashboardService] Sample activity types: ${allActivities.slice(0, 3).map(a => a.type).join(', ')}`);
  }

  // 2. Filtrer pour les calories actives
  const filteredActivities = selectedTypes 
    ? allActivities.filter(a => selectedTypes.includes(a.type))
    : allActivities;

  const activeBurnedTotal = filteredActivities.reduce((sum, a) => sum + (a.calories || 0), 0);
  const totalMovingTimeSeconds = allActivities.reduce((sum, a) => sum + a.movingTime, 0);
  
  // Calcul de la durée de la période
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.max(24, diffMs / (1000 * 3600));
  
  // Natural burn : on retire le temps passé en activité (toutes activités confondues)
  const naturalBurnTotal = hourlyNaturalBurn * Math.max(0, diffHours - (totalMovingTimeSeconds / 3600));

  // 3. Calories consommées (repas)
  const mealsSum = await prisma.mealLog.aggregate({
    where: { userId, consumedAt: { gte: start, lte: end } },
    _sum: { totalCalories: true },
  });
  const consumedTotal = mealsSum._sum.totalCalories || 0;

  // 4. Daily Breakdown pour le graphique
  const dailyStats = [];
  const numDays = Math.ceil(diffHours / 24);

  for (let i = 0; i < numDays; i++) {
    const dayStart = new Date(start);
    dayStart.setDate(start.getDate() + i);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const dayActivitiesAll = allActivities.filter(a => {
      const d = new Date(a.startDate);
      return d >= dayStart && d <= dayEnd;
    });

    const dayActivitiesFiltered = selectedTypes
      ? dayActivitiesAll.filter(a => selectedTypes.includes(a.type))
      : dayActivitiesAll;

    const dayActiveKcal = dayActivitiesFiltered.reduce((sum, a) => sum + (a.calories || 0), 0);
    const dayActiveTime = dayActivitiesAll.reduce((sum, a) => sum + a.movingTime, 0) / 3600;
    const dayNaturalKcal = hourlyNaturalBurn * Math.max(0, 24 - dayActiveTime);

    const dayMealsKcal = await prisma.mealLog.aggregate({
      where: { userId, consumedAt: { gte: dayStart, lte: dayEnd } },
      _sum: { totalCalories: true },
    });

    dailyStats.push({
      date: dayStart.toISOString(),
      burned: dayActiveKcal + dayNaturalKcal,
      consumed: dayMealsKcal._sum.totalCalories || 0,
      activeKcal: dayActiveKcal,
      naturalKcal: dayNaturalKcal,
    });
  }

  console.log(`[DashboardService] Final Stats -> Sport: ${sport || 'all'}, Active: ${activeBurnedTotal}, Natural: ${naturalBurnTotal}`);

  return {
    burned: activeBurnedTotal + naturalBurnTotal,
    activeBurned: activeBurnedTotal,
    naturalBurned: naturalBurnTotal,
    consumed: consumedTotal,
    net: consumedTotal - (activeBurnedTotal + naturalBurnTotal),
    dailyStats
  };
};
