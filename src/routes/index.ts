import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
import * as auth from "../controllers/auth.controller";
import * as strava from "../controllers/strava.controller";
import * as food from "../controllers/food.controller";
import * as meal from "../controllers/meal.controller";
import * as dash from "../controllers/dashboard.controller";

export const router = Router();

// Auth & Webhooks
router.post("/auth/strava", auth.stravaLogin);
router.get("/strava/webhook", strava.verifyWebhook);
router.post("/strava/webhook", strava.handleWebhook);

// Protected
router.get("/dashboard", authenticateToken, dash.getDashboard);
router.get("/food/barcode/:code", authenticateToken, food.getByBarcode);
router.get("/food/search", authenticateToken, food.searchCiqual);
router.post("/meals/log", authenticateToken, meal.logMeal);
