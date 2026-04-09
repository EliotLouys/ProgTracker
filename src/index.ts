import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { router } from "./routes/index";
import { initStravaWebhook } from "./services/strava.service";

dotenv.config();

// BigInt serialization polyfill
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Serveur démarré sur le port ${PORT}`);

  // Initialisation automatique du Webhook Strava
  await initStravaWebhook();
});
