import axios from "axios";
import { getValidStravaAccessTokenByUserId } from "../services/strava.service";
import { prisma } from "../lib/prisma";

export async function importHistory(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error("❌ Utilisateur introuvable ou Token Strava manquant.");
    return;
  }

  try {
    const listToken = await getValidStravaAccessTokenByUserId(userId);
    console.log("🚴‍♂️ Récupération de la liste des activités...");
    const res = await axios.get(
      "https://www.strava.com/api/v3/athlete/activities?per_page=100",
      {
        headers: { Authorization: `Bearer ${listToken}` },
      },
    );

    for (const act of res.data) {
      const exists = await prisma.activity.findUnique({
        where: { id: BigInt(act.id) },
      });
      if (exists) {
        console.log(`⏩ Activité ${act.id} déjà en base. On skip.`);
        continue;
      }

      console.log(`🔍 Fetch des détails pour l'activité ${act.id}...`);
      const detailToken = await getValidStravaAccessTokenByUserId(userId);
      const detail = await axios.get(
        `https://www.strava.com/api/v3/activities/${act.id}`,
        {
          headers: { Authorization: `Bearer ${detailToken}` },
        },
      );

      await prisma.activity.create({
        data: {
          id: BigInt(detail.data.id),
          userId: user.id,
          name: detail.data.name,
          distance: detail.data.distance,
          movingTime: detail.data.moving_time,
          calories: detail.data.calories || 0,
          startDate: new Date(detail.data.start_date),
          type: detail.data.type,
        },
      });
      console.log(`✅ Activité ${detail.data.id} insérée.`);
      await new Promise((r) => setTimeout(r, 600)); // Respect du Rate Limit Strava
    }
    console.log("🎉 Backfill terminé !");
  } catch (error: any) {
    const message = error.response?.data || error.message;
    console.error("Erreur lors du backfill:", message);
    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message),
    );
  }
}
