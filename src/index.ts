import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { router } from "./routes";
import { initStravaWebhook } from "./services/strava.service";

dotenv.config();

// VALIDATION DES VARIABLES D'ENVIRONNEMENT CRITIQUES
const REQUIRED_ENV = ["JWT_SECRET", "DATABASE_URL", "STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`❌ Erreur : Variables d'environnement manquantes : ${missingEnv.join(", ")}`);
  process.exit(1);
}

if (process.env.JWT_SECRET === "undefined" || process.env.JWT_SECRET?.length! < 32) {
  console.warn("⚠️ Attention : JWT_SECRET est absent ou trop court. Sécurité compromise.");
}

const app = express();

// CONFIGURATION CORS PLUS STRICTE
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:8081", "http://localhost:19006"];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  }
}));

app.use(express.json());

// LOGGER DE REQUÊTES : Pour voir ce qui arrive au serveur
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

app.use("/api", router);

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`-----------------------------------------------`);
  console.log(`🚀 Serveur Velotaf prêt sur le port ${PORT}`);
  console.log(`🔗 Accessible en local via : http://localhost:${PORT}`);
  console.log(`🌐 Accessible sur le réseau via ton IP locale`);
  console.log(`-----------------------------------------------`);

  // RÉACTIVATION DU WEBHOOK STRAVA AU DÉMARRAGE
  try {
    await initStravaWebhook();
  } catch (err) {
    console.error("Erreur lors de l'init du webhook Strava:", err);
  }
});
