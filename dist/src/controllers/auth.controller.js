"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.getProfile = exports.stravaLogin = exports.stravaCallback = exports.getStravaAuthUrl = void 0;
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const strava_service_1 = require("../services/strava.service");
const buildApiJwt = (userId) => {
    return jsonwebtoken_1.default.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: "30d",
    });
};
const encryption_1 = require("../lib/encryption");
const upsertUserFromStravaCode = async (code) => {
    const resp = await (0, strava_service_1.exchangeStravaCode)(code);
    const { access_token, refresh_token, expires_at, athlete } = resp;
    if (!athlete?.id) {
        throw new Error("Invalid Strava response: athlete missing");
    }
    const user = await prisma_1.prisma.user.upsert({
        where: { stravaId: BigInt(athlete.id) },
        update: {
            stravaAccessToken: (0, encryption_1.encrypt)(access_token),
            stravaRefreshToken: (0, encryption_1.encrypt)(refresh_token),
            stravaTokenExpiresAt: expires_at,
        },
        create: {
            stravaId: BigInt(athlete.id),
            stravaAccessToken: (0, encryption_1.encrypt)(access_token),
            stravaRefreshToken: (0, encryption_1.encrypt)(refresh_token),
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
const getProfile = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.userId } });
    if (!user)
        return res.status(404).json({ error: "User not found" });
    res.json({
        weightKg: user.weightKg,
        heightCm: user.heightCm,
        age: user.age,
        gender: user.gender,
        activityLevel: user.activityLevel,
        proteinsGoal: user.proteinsGoal,
        carbsGoal: user.carbsGoal,
        fatsGoal: user.fatsGoal,
    });
};
exports.getProfile = getProfile;
const updateProfile = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    const { weightKg, heightCm, age, gender, activityLevel, proteinsGoal, carbsGoal, fatsGoal } = req.body;
    const user = await prisma_1.prisma.user.update({
        where: { id: req.userId },
        data: {
            weightKg: weightKg ? parseFloat(weightKg) : null,
            heightCm: heightCm ? parseFloat(heightCm) : null,
            age: age ? parseInt(age) : null,
            gender,
            activityLevel,
            proteinsGoal: proteinsGoal !== undefined && proteinsGoal !== null && proteinsGoal !== "" ? parseFloat(proteinsGoal) : null,
            carbsGoal: carbsGoal !== undefined && carbsGoal !== null && carbsGoal !== "" ? parseFloat(carbsGoal) : null,
            fatsGoal: fatsGoal !== undefined && fatsGoal !== null && fatsGoal !== "" ? parseFloat(fatsGoal) : null,
        },
    });
    // BigInt serialization fix
    const responseData = {
        ...user,
        stravaId: user.stravaId?.toString()
    };
    res.json(responseData);
};
exports.updateProfile = updateProfile;
