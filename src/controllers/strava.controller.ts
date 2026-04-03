import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getDetailedActivity } from "../services/strava.service";

export const verifyWebhook = (req: Request, res: Response) => {
  const challenge = req.query["hub.challenge"];
  if (
    req.query["hub.verify_token"] === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
  ) {
    return res.status(200).json({ "hub.challenge": challenge });
  }
  res.sendStatus(403);
};

export const handleWebhook = async (req: Request, res: Response) => {
  res.status(200).send("EVENT_RECEIVED");
  const { object_type, aspect_type, object_id, owner_id } = req.body;
  if (object_type === "activity" && aspect_type === "create") {
    const user = await prisma.user.findUnique({
      where: { stravaId: owner_id },
    });
    if (user && user.stravaAccessToken) {
      const data = await getDetailedActivity(object_id, user.stravaAccessToken);
      await prisma.activity.create({
        data: {
          id: BigInt(data.id),
          userId: user.id,
          name: data.name,
          distance: data.distance,
          movingTime: data.moving_time,
          calories: data.calories || 0,
          startDate: new Date(data.start_date),
          type: data.type,
        },
      });
    }
  }
};
