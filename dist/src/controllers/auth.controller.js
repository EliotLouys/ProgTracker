"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stravaLogin = exports.stravaCallback = exports.getStravaAuthUrl = void 0;
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const strava_service_1 = require("../services/strava.service");
const buildApiJwt = (userId) => {
    return jsonwebtoken_1.default.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: "30d",
    });
};
const upsertUserFromStravaCode = async (code) => {
    const resp = await (0, strava_service_1.exchangeStravaCode)(code);
    const { access_token, refresh_token, expires_at, athlete } = resp;
    if (!athlete?.id) {
        throw new Error("Invalid Strava response: athlete missing");
    }
    const user = await prisma_1.prisma.user.upsert({
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
const getStravaAuthUrl = async (req, res) => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const redirectUri = process.env.STRAVA_REDIRECT_URI;
    const scope = process.env.STRAVA_SCOPES || "read,activity:read_all";
    const appRedirectUri = typeof req.query.app_redirect_uri === "string"
        ? req.query.app_redirect_uri
        : undefined;
    if (!clientId || !redirectUri) {
        return res.status(500).json({
            error: "Missing STRAVA_CLIENT_ID or STRAVA_REDIRECT_URI",
        });
    }
    const state = jsonwebtoken_1.default.sign({ nonce: (0, crypto_1.randomUUID)(), appRedirectUri }, process.env.JWT_SECRET, { expiresIn: "10m" });
    const authUrl = new URL("https://www.strava.com/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("approval_prompt", "auto");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);
    res.json({ authUrl: authUrl.toString(), state });
};
exports.getStravaAuthUrl = getStravaAuthUrl;
const stravaCallback = async (req, res) => {
    const code = req.query.code;
    const state = req.query.state;
    if (typeof code !== "string") {
        return res.status(400).json({ error: "Missing Strava code" });
    }
    if (typeof state !== "string") {
        return res.status(400).json({ error: "Missing OAuth state" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(state, process.env.JWT_SECRET);
        const { token, user, athlete } = await upsertUserFromStravaCode(code);
        if (decoded.appRedirectUri) {
            const target = new URL(decoded.appRedirectUri);
            target.searchParams.set("token", token);
            target.searchParams.set("firstname", athlete.firstname || "");
            return res.redirect(target.toString());
        }
        res.json({ token, user: { id: user.id, firstname: athlete.firstname } });
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return res.status(401).json({ error: "Invalid OAuth state" });
        }
        res.status(500).json({ error: "OAuth callback failed" });
    }
};
exports.stravaCallback = stravaCallback;
const stravaLogin = async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: "Missing Strava code" });
    }
    try {
        const { token, user, athlete } = await upsertUserFromStravaCode(code);
        res.json({ token, user: { id: user.id, firstname: athlete.firstname } });
    }
    catch (err) {
        res.status(500).json({ error: "Auth failed" });
    }
};
exports.stravaLogin = stravaLogin;
