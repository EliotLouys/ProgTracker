// prisma/user-seed.ts
import { PrismaClient } from "@prisma/client";

// Supprime : const prisma = new PrismaClient();

export async function seedUsers(prisma: PrismaClient) {
  const user = await prisma.user.upsert({
    where: { id: "user_dev_123" },
    update: {},
    create: {
      id: "user_dev_123",
      stravaAccessToken: "",
      stravaRefreshToken: "",
      // Assure-toi que la clé correspond à ton schema.prisma actuel
      stravaTokenExpiresAt: Math.floor(Date.now() / 1000) + 21600,
    },
  });

  console.log(`✅ Utilisateur de test créé ou mis à jour : ${user.id}`);
}

// Supprime l'exécution main().catch(...) à la fin du fichier
