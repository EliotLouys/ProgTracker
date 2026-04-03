import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { id: "user_dev_123" }, // ID stable pour tes tests
    update: {},
    create: {
      id: "user_dev_123",
      // Ces tokens sont temporaires et expireront vite
      stravaAccessToken: "14ef24b4d2fe25824c422ea225f0866ffaff7e22",
      stravaRefreshToken: "d3911ebd4c9931e81738c2b90486612b1be5b4f9",
      // Stocke l'expiration en secondes (Epoch) comme le renvoie Strava
      expiresAt: Math.floor(Date.now() / 1000) + 21600,
    },
  });

  console.log(`✅ Utilisateur de test créé ou mis à jour : ${user.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
