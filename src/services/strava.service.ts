import axios from "axios";
import { prisma } from "../lib/prisma";

const STRAVA_OAUTH_TOKEN_URL = "https://www.strava.com/oauth/token";
const TOKEN_EXPIRY_SAFETY_WINDOW_SECONDS = 60;

type OAuthTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: {
    id: number;
    firstname?: string;
  };
};

const nowInSeconds = () => Math.floor(Date.now() / 1000);

const requireStravaClientCredentials = () => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET");
  }
  return { clientId, clientSecret };
};

const shouldRefreshToken = (expiresAt: number | null) => {
  if (!expiresAt) return true;
  return expiresAt <= nowInSeconds() + TOKEN_EXPIRY_SAFETY_WINDOW_SECONDS;
};

export const exchangeStravaCode = async (code: string) => {
  const { clientId, clientSecret } = requireStravaClientCredentials();
  const resp = await axios.post<OAuthTokenResponse>(STRAVA_OAUTH_TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
  });
  return resp.data;
};

export const refreshStravaAccessToken = async (refreshToken: string) => {
  const { clientId, clientSecret } = requireStravaClientCredentials();
  const resp = await axios.post<OAuthTokenResponse>(STRAVA_OAUTH_TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return resp.data;
};

const ensureValidTokenForUser = async (user: {
  id: string;
  stravaAccessToken: string | null;
  stravaRefreshToken: string | null;
  stravaTokenExpiresAt: number | null;
}) => {
  if (!user.stravaAccessToken || !user.stravaRefreshToken) {
    throw new Error("Strava account is not connected for this user");
  }

  if (!shouldRefreshToken(user.stravaTokenExpiresAt)) {
    return user.stravaAccessToken;
  }

  const refreshed = await refreshStravaAccessToken(user.stravaRefreshToken);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      stravaAccessToken: refreshed.access_token,
      stravaRefreshToken: refreshed.refresh_token,
      stravaTokenExpiresAt: refreshed.expires_at,
    },
  });
  return refreshed.access_token;
};

export const getValidStravaAccessTokenByUserId = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }
  return ensureValidTokenForUser(user);
};

export const getValidStravaAccessTokenByStravaId = async (stravaId: bigint) => {
  const user = await prisma.user.findUnique({ where: { stravaId } });
  if (!user) {
    return null;
  }
  const accessToken = await ensureValidTokenForUser(user);
  return { user, accessToken };
};

export const getDetailedActivity = async (
  activityId: number,
  accessToken: string,
) => {
  const resp = await axios.get(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return resp.data;
};

export const initStravaWebhook = async () => {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  const publicUrl = process.env.APP_PUBLIC_URL;

  if (!clientId || !clientSecret || !verifyToken || !publicUrl) {
    console.warn(
      "Variables d'environnement manquantes, initialisation du webhook Strava ignorée.",
    );
    return;
  }

  const callbackUrl = `${publicUrl}/api/strava/webhook`;

  try {
    // 1. Récupérer l'abonnement actif
    const { data: subscriptions } = await axios.get(
      "https://www.strava.com/api/v3/push_subscriptions",
      {
        params: { client_id: clientId, client_secret: clientSecret },
      },
    );

    if (subscriptions.length > 0) {
      const currentSub = subscriptions[0];

      // Si l'URL est déjà la bonne, on ne touche à rien
      if (currentSub.callback_url === callbackUrl) {
        console.log(`Webhook Strava déjà actif sur : ${callbackUrl}`);
        return;
      }

      // Si l'URL a changé (ex: nouveau Ngrok), on supprime l'ancien
      console.log(
        `🔄 URL différente détectée. Suppression de l'abonnement ID: ${currentSub.id}`,
      );
      await axios.delete(
        `https://www.strava.com/api/v3/push_subscriptions/${currentSub.id}`,
        {
          params: { client_id: clientId, client_secret: clientSecret },
        },
      );
    }

    // 2. Créer le nouvel abonnement
    console.log(`🚀 Création du webhook Strava sur : ${callbackUrl}`);
    await axios.post("https://www.strava.com/api/v3/push_subscriptions", {
      client_id: clientId,
      client_secret: clientSecret,
      callback_url: callbackUrl,
      verify_token: verifyToken,
    });

    console.log("✅ Abonnement Webhook Strava initialisé avec succès.");
  } catch (error: any) {
    console.error(
      "❌ Échec de l'initialisation du webhook Strava :",
      error.response?.data || error.message,
    );
  }
};
