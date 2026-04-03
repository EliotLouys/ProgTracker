// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
// Supposons que tu as factorisé le code de tes seeds dans des fonctions exportées
import { seedCiqual } from "./seed-ciqual";
import { seedUsers } from "./user-seed";

const prisma = new PrismaClient();

async function main() {
  console.log("Début du seeding global...");

  await seedCiqual(prisma);
  await seedUsers(prisma);

  console.log("Seeding terminé !");
}

main()
  .catch((e) => {
    console.error("Erreur lors du seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
