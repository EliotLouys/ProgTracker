import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { router } from "./routes/index";
import { initStravaWebhook } from "./services/strava.service";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);

app.listen(process.env.PORT || 3000, async () => {
  console.log(`Serveur démarré sur le port ${process.env.PORT || 3000}`);

  // Initialisation automatique du Webhook Strava
  await initStravaWebhook();
});
