"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importHistory = importHistory;
const axios_1 = __importDefault(require("axios"));
const strava_service_1 = require("../services/strava.service");
const prisma_1 = require("../lib/prisma");
async function importHistory(userId) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        console.error("❌ Utilisateur introuvable ou Token Strava manquant.");
        return;
    }
    try {
        const listToken = await (0, strava_service_1.getValidStravaAccessTokenByUserId)(userId);
        console.log("🚴‍♂️ Récupération de la liste des activités...");
        const res = await axios_1.default.get("https://www.strava.com/api/v3/athlete/activities?per_page=30", {
            headers: { Authorization: `Bearer ${listToken}` },
        });
        for (const act of res.data) {
            const exists = await prisma_1.prisma.activity.findUnique({
                where: { id: BigInt(act.id) },
            });
            if (exists) {
                console.log(`⏩ Activité ${act.id} déjà en base. On skip.`);
                continue;
            }
            console.log(`🔍 Fetch des détails pour l'activité ${act.id}...`);
            const detailToken = await (0, strava_service_1.getValidStravaAccessTokenByUserId)(userId);
            const detail = await axios_1.default.get(`https://www.strava.com/api/v3/activities/${act.id}`, {
                headers: { Authorization: `Bearer ${detailToken}` },
            });
            await prisma_1.prisma.activity.create({
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
    }
    catch (error) {
        const message = error.response?.data || error.message;
        console.error("Erreur lors du backfill:", message);
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
    }
}
