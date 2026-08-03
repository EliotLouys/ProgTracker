"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initStravaWebhook = exports.getDetailedActivity = exports.getValidStravaAccessTokenByStravaId = exports.getValidStravaAccessTokenByUserId = exports.refreshStravaAccessToken = exports.exchangeStravaCode = void 0;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../lib/prisma");
const encryption_1 = require("../lib/encryption");
const STRAVA_OAUTH_TOKEN_URL = "https://www.strava.com/oauth/token";
const TOKEN_EXPIRY_SAFETY_WINDOW_SECONDS = 60;
const nowInSeconds = () => Math.floor(Date.now() / 1000);
const requireStravaClientCredentials = () => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error("Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET");
    }
    return { clientId, clientSecret };
};
const shouldRefreshToken = (expiresAt) => {
    if (!expiresAt)
        return true;
    return expiresAt <= nowInSeconds() + TOKEN_EXPIRY_SAFETY_WINDOW_SECONDS;
};
const exchangeStravaCode = async (code) => {
    const { clientId, clientSecret } = requireStravaClientCredentials();
    const resp = await axios_1.default.post(STRAVA_OAUTH_TOKEN_URL, {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
    });
    return resp.data;
};
exports.exchangeStravaCode = exchangeStravaCode;
const refreshStravaAccessToken = async (refreshToken) => {
    const { clientId, clientSecret } = requireStravaClientCredentials();
    const resp = await axios_1.default.post(STRAVA_OAUTH_TOKEN_URL, {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
    });
    return resp.data;
};
exports.refreshStravaAccessToken = refreshStravaAccessToken;
const ensureValidTokenForUser = async (user) => {
    const decryptedAccessToken = (0, encryption_1.decrypt)(user.stravaAccessToken);
    const decryptedRefreshToken = (0, encryption_1.decrypt)(user.stravaRefreshToken);
    if (!decryptedAccessToken || !decryptedRefreshToken) {
        throw new Error("Strava account is not connected for this user");
    }
    if (!shouldRefreshToken(user.stravaTokenExpiresAt)) {
        return decryptedAccessToken;
    }
    const refreshed = await (0, exports.refreshStravaAccessToken)(decryptedRefreshToken);
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: {
            stravaAccessToken: (0, encryption_1.encrypt)(refreshed.access_token),
            stravaRefreshToken: (0, encryption_1.encrypt)(refreshed.refresh_token),
            stravaTokenExpiresAt: refreshed.expires_at,
        },
    });
    return refreshed.access_token;
};
const getValidStravaAccessTokenByUserId = async (userId) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new Error("User not found");
    }
    return ensureValidTokenForUser(user);
};
exports.getValidStravaAccessTokenByUserId = getValidStravaAccessTokenByUserId;
const getValidStravaAccessTokenByStravaId = async (stravaId) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { stravaId } });
    if (!user) {
        return null;
    }
    const accessToken = await ensureValidTokenForUser(user);
    return { user, accessToken };
};
exports.getValidStravaAccessTokenByStravaId = getValidStravaAccessTokenByStravaId;
const getDetailedActivity = async (activityId, accessToken) => {
    const resp = await axios_1.default.get(`https://www.strava.com/api/v3/activities/${activityId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return resp.data;
};
exports.getDetailedActivity = getDetailedActivity;
const initStravaWebhook = async () => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
    const publicUrl = process.env.APP_PUBLIC_URL;
    if (!clientId || !clientSecret || !verifyToken || !publicUrl) {
        console.warn("Variables d'environnement manquantes, initialisation du webhook Strava ignorée.");
        return;
    }
    const callbackUrl = `${publicUrl}/api/strava/webhook`;
    try {
        // 1. Récupérer l'abonnement actif
        const { data: subscriptions } = await axios_1.default.get("https://www.strava.com/api/v3/push_subscriptions", {
            params: { client_id: clientId, client_secret: clientSecret },
        });
        if (subscriptions.length > 0) {
            const currentSub = subscriptions[0];
            // Si l'URL est déjà la bonne, on ne touche à rien
            if (currentSub.callback_url === callbackUrl) {
                console.log(`Webhook Strava déjà actif sur : ${callbackUrl}`);
                return;
            }
            // Si l'URL a changé (ex: nouveau Ngrok), on supprime l'ancien
            console.log(`🔄 URL différente détectée. Suppression de l'abonnement ID: ${currentSub.id}`);
            await axios_1.default.delete(`https://www.strava.com/api/v3/push_subscriptions/${currentSub.id}`, {
                params: { client_id: clientId, client_secret: clientSecret },
            });
        }
        // 2. Créer le nouvel abonnement
        console.log(`🚀 Création du webhook Strava sur : ${callbackUrl}`);
        await axios_1.default.post("https://www.strava.com/api/v3/push_subscriptions", {
            client_id: clientId,
            client_secret: clientSecret,
            callback_url: callbackUrl,
            verify_token: verifyToken,
        });
        console.log("✅ Abonnement Webhook Strava initialisé avec succès.");
    }
    catch (error) {
        console.error("❌ Échec de l'initialisation du webhook Strava :", error.response?.data || error.message);
    }
};
exports.initStravaWebhook = initStravaWebhook;
