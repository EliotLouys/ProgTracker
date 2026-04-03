"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const auth = __importStar(require("../controllers/auth.controller"));
const strava = __importStar(require("../controllers/strava.controller"));
const food = __importStar(require("../controllers/food.controller"));
const meal = __importStar(require("../controllers/meal.controller"));
const dash = __importStar(require("../controllers/dashboard.controller"));
exports.router = (0, express_1.Router)();
// Auth & Webhooks
exports.router.get("/auth/strava/url", auth.getStravaAuthUrl);
exports.router.get("/auth/strava/callback", auth.stravaCallback);
exports.router.post("/auth/strava", auth.stravaLogin);
exports.router.get("/strava/webhook", strava.verifyWebhook);
exports.router.post("/strava/webhook", strava.handleWebhook);
exports.router.post("/strava/backfill", auth_middleware_1.authenticateToken, strava.stravaBackfill);
// Protected
exports.router.get("/dashboard", auth_middleware_1.authenticateToken, dash.getDashboard);
exports.router.get("/activities", auth_middleware_1.authenticateToken, dash.getActivities);
exports.router.get("/food/barcode/:code", auth_middleware_1.authenticateToken, food.getByBarcode);
exports.router.get("/food/search", auth_middleware_1.authenticateToken, food.searchCiqual);
exports.router.post("/meals/log", auth_middleware_1.authenticateToken, meal.logMeal);
