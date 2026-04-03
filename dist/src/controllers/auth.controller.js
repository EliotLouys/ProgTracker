"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stravaLogin = void 0;
const axios_1 = __importDefault(require("axios"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const stravaLogin = async (req, res) => {
    const { code } = req.body;
    try {
        const resp = await axios_1.default.post("https://www.strava.com/oauth/token", {
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            code,
            grant_type: "authorization_code",
        });
        const { access_token, refresh_token, athlete } = resp.data;
        const user = await prisma_1.prisma.user.upsert({
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
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
        res.json({ token, user: { id: user.id, firstname: athlete.firstname } });
    }
    catch (err) {
        res.status(500).json({ error: "Auth failed" });
    }
};
exports.stravaLogin = stravaLogin;
