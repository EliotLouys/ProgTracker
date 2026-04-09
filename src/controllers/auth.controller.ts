import { Request, Response } from "express";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { exchangeStravaCode } from "../services/strava.service";

type AuthStatePayload = {
  nonce: string;
  appRedirectUri?: string;
};

const buildApiJwt = (userId: string) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    expiresIn: "30d",
  });
};

const upsertUserFromStravaCode = async (code: string) => {
  const resp = await exchangeStravaCode(code);
  const { access_token, refresh_token, expires_at, athlete } = resp;

  if (!athlete?.id) {
    throw new Error("Invalid Strava response: athlete missing");
  }

  const user = await prisma.user.upsert({
    where: { stravaId: BigInt(athlete.id) },
    update: {
      stravaAccessToken: access_token,
      stravaRefreshToken: refresh_token,
      stravaTokenExpiresAt: expires_at,
    },
    create: {
      stravaId: BigInt(athlete.id),
      stravaAccessToken: access_token,
      stravaRefreshToken: refresh_token,
      stravaTokenExpiresAt: expires_at,
    },
  });

  const token = buildApiJwt(user.id);
  return { token, user, athlete };
};

export const getStravaAuthUrl = async (req: Request, res: Response) => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  const scope = process.env.STRAVA_SCOPES || "read,activity:read_all";
  const appRedirectUri =
    typeof req.query.app_redirect_uri === "string"
      ? req.query.app_redirect_uri
      : undefined;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: "Missing STRAVA_CLIENT_ID or STRAVA_REDIRECT_URI",
    });
  }

  const state = jwt.sign(
    { nonce: randomUUID(), appRedirectUri } satisfies AuthStatePayload,
    process.env.JWT_SECRET as string,
    { expiresIn: "10m" },
  );

  const authUrl = new URL("https://www.strava.com/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("approval_prompt", "auto");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);

  res.json({ authUrl: authUrl.toString(), state });
};

export const stravaCallback = async (req: Request, res: Response) => {
  const code = req.query.code;
  const state = req.query.state;

  if (typeof code !== "string") {
    return res.status(400).json({ error: "Missing Strava code" });
  }
  if (typeof state !== "string") {
    return res.status(400).json({ error: "Missing OAuth state" });
  }

  try {
    const decoded = jwt.verify(
      state,
      process.env.JWT_SECRET as string,
    ) as AuthStatePayload;
    const { token, user, athlete } = await upsertUserFromStravaCode(code);
    if (decoded.appRedirectUri) {
      const finalUrl = `${decoded.appRedirectUri}?token=${token}&firstname=${encodeURIComponent(athlete.firstname || "")}`;

      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f3f4f6; }
              .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; }
              .btn { margin-top: 1rem; display: inline-block; background: #fc4c02; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="card">
              <p>Connexion réussie !</p>
              <p>Redirection vers Velotaf Dashboard...</p>
              <a href="${finalUrl}" class="btn">Ouvrir l'application</a>
            </div>
            <script>
              // Tentative de redirection automatique
              window.location.replace("${finalUrl}");
              
              // Second essai après un court délai
              setTimeout(function() {
                window.location.href = "${finalUrl}";
              }, 1000);
            </script>
          </body>
        </html>
      `);
    }

    res.json({ token, user: { id: user.id, firstname: athlete.firstname } });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Invalid OAuth state" });
    }
    res.status(500).json({ error: "OAuth callback failed" });
  }
};

export const stravaLogin = async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: "Missing Strava code" });
  }
  try {
    const { token, user, athlete } = await upsertUserFromStravaCode(code);
    res.json({ token, user: { id: user.id, firstname: athlete.firstname } });
  } catch (err) {
    res.status(500).json({ error: "Auth failed" });
  }
};

import { AuthRequest } from "../middlewares/auth.middleware";

export const getProfile = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    age: user.age,
    gender: user.gender,
    activityLevel: user.activityLevel,
  });
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.sendStatus(401);
  const { weightKg, heightCm, age, gender, activityLevel } = req.body;
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { 
      weightKg: weightKg ? parseFloat(weightKg) : null, 
      heightCm: heightCm ? parseFloat(heightCm) : null, 
      age: age ? parseInt(age) : null, 
      gender, 
      activityLevel 
    },
  });
  
  // BigInt serialization fix
  const responseData = {
    ...user,
    stravaId: user.stravaId?.toString()
  };
  
  res.json(responseData);
};
