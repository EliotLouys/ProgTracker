import { Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export const stravaLogin = async (req: Request, res: Response) => {
  const { code } = req.body;
  try {
    const resp = await axios.post("https://www.strava.com/oauth/token", {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    });
    const { access_token, refresh_token, athlete } = resp.data;
    const user = await prisma.user.upsert({
      where: { stravaId: athlete.id },
      update: {
        stravaAccessToken: access_token,
        stravaRefreshToken: refresh_token,
      },
      create: {
        email: `${athlete.id}@strava.user`,
        stravaId: athlete.id,
        stravaAccessToken: access_token,
        stravaRefreshToken: refresh_token,
      },
    });
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: "30d" },
    );
    res.json({ token, user: { id: user.id, firstname: athlete.firstname } });
  } catch (err) {
    res.status(500).json({ error: "Auth failed" });
  }
};
