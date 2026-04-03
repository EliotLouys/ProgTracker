"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stravaBackfill = exports.handleWebhook = exports.verifyWebhook = void 0;
const prisma_1 = require("../lib/prisma");
const strava_service_1 = require("../services/strava.service");
const backfill_1 = require("../scripts/backfill");
const verifyWebhook = (req, res) => {
    const challenge = req.query["hub.challenge"];
    if (req.query["hub.verify_token"] === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
        return res.status(200).json({ "hub.challenge": challenge });
    }
    res.sendStatus(403);
};
exports.verifyWebhook = verifyWebhook;
const handleWebhook = async (req, res) => {
    res.status(200).send("EVENT_RECEIVED");
    const { object_type, aspect_type, object_id, owner_id } = req.body;
    if (object_type !== "activity" || aspect_type !== "create") {
        return;
    }
    try {
        const stravaId = BigInt(owner_id);
        const result = await (0, strava_service_1.getValidStravaAccessTokenByStravaId)(stravaId);
        if (!result) {
            return;
        }
        const data = await (0, strava_service_1.getDetailedActivity)(object_id, result.accessToken);
        await prisma_1.prisma.activity.create({
            data: {
                id: BigInt(data.id),
                userId: result.user.id,
                name: data.name,
                distance: data.distance,
                movingTime: data.moving_time,
                calories: data.calories || 0,
                startDate: new Date(data.start_date),
                type: data.type,
            },
        });
    }
    catch (error) {
        console.error("Strava webhook processing failed:", error);
    }
};
exports.handleWebhook = handleWebhook;
const stravaBackfill = async (req, res) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        await (0, backfill_1.importHistory)(userId);
        res.status(200).json({ message: "Backfill completed" });
    }
    catch (error) {
        console.error("Strava backfill failed:", error);
        res.status(500).json({ error: "Backfill failed" });
    }
};
exports.stravaBackfill = stravaBackfill;
