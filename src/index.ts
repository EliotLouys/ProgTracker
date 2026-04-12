import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { router } from "./routes";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// LOGGER DE REQUÊTES : Pour voir ce qui arrive au serveur
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

app.use("/api", router);

// Correction du type pour TypeScript : on force la conversion en nombre
const PORT = Number(process.env.PORT) || 3000;

// On écoute sur '0.0.0.0' pour être accessible depuis le réseau local
app.listen(PORT, '0.0.0.0', () => {
  console.log(`-----------------------------------------------`);
  console.log(`🚀 Serveur Velotaf prêt sur le port ${PORT}`);
  console.log(`🔗 Accessible en local via : http://localhost:${PORT}`);
  console.log(`🌐 Accessible sur le réseau via ton IP locale`);
  console.log(`-----------------------------------------------`);
});
