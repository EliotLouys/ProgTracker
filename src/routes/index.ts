import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware";
import * as auth from "../controllers/auth.controller";
import * as strava from "../controllers/strava.controller";
import * as food from "../controllers/food.controller";
import * as meal from "../controllers/meal.controller";
import * as dash from "../controllers/dashboard.controller";

export const router = Router();

// Auth & Webhooks
router.get("/auth/strava/url", auth.getStravaAuthUrl);
router.get("/auth/strava/callback", auth.stravaCallback);
router.post("/auth/strava", auth.stravaLogin);
router.get("/profile", authenticateToken, auth.getProfile);
router.put("/profile", authenticateToken, auth.updateProfile);
router.get("/strava/webhook", strava.verifyWebhook);
router.post("/strava/webhook", strava.handleWebhook);
router.post("/strava/backfill", authenticateToken, strava.stravaBackfill);

// Protected
router.get("/dashboard", authenticateToken, dash.getDashboard);
router.get("/activities", authenticateToken, dash.getActivities);

// Food & Search
router.get("/food/barcode/:code", authenticateToken, food.getByBarcode);
router.get("/food/search", authenticateToken, food.searchFood);
router.get("/food/custom", authenticateToken, food.listCustomFoods);
router.post("/food/custom", authenticateToken, food.createCustomFood);
router.delete("/food/custom/:id", authenticateToken, food.deleteCustomFood);

// Recipes
router.get("/recipes", authenticateToken, food.listRecipes);
router.post("/recipes", authenticateToken, food.createRecipe);
router.delete("/recipes/:id", authenticateToken, food.deleteRecipe);

// Meals
router.get("/meals", authenticateToken, meal.getMeals);
router.post("/meals/log", authenticateToken, meal.logMeal);
router.delete("/meals/:id", authenticateToken, meal.deleteMeal);
