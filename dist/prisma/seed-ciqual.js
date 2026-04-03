"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("Début de l'import CIQUAL...");
    const results = [];
    // Remplacer par le chemin de ton CSV CIQUAL nettoyé
    fs_1.default.createReadStream("./ciqual_data.csv")
        .pipe((0, csv_parser_1.default)({ separator: ";" }))
        .on("data", (data) => results.push(data))
        .on("end", async () => {
        for (const item of results) {
            // Adapté selon les colonnes exactes de ton CSV
            await prisma.ciqualItem.upsert({
                where: { id: parseInt(item.alim_code) },
                update: {},
                create: {
                    id: parseInt(item.alim_code),
                    name: item.alim_nom_fr,
                    kcalPer100g: parseFloat(item.Energie_kcal) || 0,
                    proteins: parseFloat(item.Proteines) || 0,
                    carbs: parseFloat(item.Glucides) || 0,
                    fats: parseFloat(item.Lipides) || 0,
                },
            });
        }
        console.log("Import CIQUAL terminé.");
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
