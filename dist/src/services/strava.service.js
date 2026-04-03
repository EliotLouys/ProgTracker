"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDetailedActivity = exports.getValidStravaAccessTokenByStravaId = exports.getValidStravaAccessTokenByUserId = exports.refreshStravaAccessToken = exports.exchangeStravaCode = void 0;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../lib/prisma");
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
    if (!user.stravaAccessToken || !user.stravaRefreshToken) {
        throw new Error("Strava account is not connected for this user");
    }
    if (!shouldRefreshToken(user.stravaTokenExpiresAt)) {
        return user.stravaAccessToken;
    }
    const refreshed = await (0, exports.refreshStravaAccessToken)(user.stravaRefreshToken);
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: {
            stravaAccessToken: refreshed.access_token,
            stravaRefreshToken: refreshed.refresh_token,
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
