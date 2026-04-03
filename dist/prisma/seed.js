"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// prisma/seed.ts
const client_1 = require("@prisma/client");
// Supposons que tu as factorisé le code de tes seeds dans des fonctions exportées
const seed_ciqual_1 = require("./seed-ciqual");
const user_seed_1 = require("./user-seed");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("Début du seeding global...");
    await (0, seed_ciqual_1.seedCiqual)(prisma);
    await (0, user_seed_1.seedUsers)(prisma);
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
