import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  getDetailedActivity,
  getValidStravaAccessTokenByStravaId,
} from "../services/strava.service";
import { importHistory } from "../scripts/backfill";

export const verifyWebhook = (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log(`[Strava Webhook] Verification request: mode=${mode}, token=${token}`);

  if (mode === "subscribe" && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    console.log("[Strava Webhook] WEBHOOK_VERIFIED");
    return res.status(200).json({ "hub.challenge": challenge });
  }

  console.error("[Strava Webhook] Verification failed: token mismatch");
  res.sendStatus(403);
};

export const handleWebhook = async (req: Request, res: Response) => {
  res.status(200).send("EVENT_RECEIVED");
  const { object_type, aspect_type, object_id, owner_id } = req.body;
  if (object_type !== "activity" || aspect_type !== "create") {
    return;
  }

  try {
    const stravaId = BigInt(owner_id);
    const result = await getValidStravaAccessTokenByStravaId(stravaId);
    if (!result) {
      return;
    }

    const data = await getDetailedActivity(object_id, result.accessToken);
    await prisma.activity.create({
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
  } catch (error) {
    console.error("Strava webhook processing failed:", error);
  }
};

export const stravaBackfill = async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    await importHistory(userId);
    res.status(200).json({ message: "Backfill completed" });
  } catch (error) {
    console.error("Strava backfill failed:", error);
    res.status(500).json({ error: "Backfill failed" });
  }
};