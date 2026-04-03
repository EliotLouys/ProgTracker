"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedCiqual = seedCiqual;
const fs_1 = __importDefault(require("fs"));
const sync_1 = require("csv-parse/sync");
// Supprime : const prisma = new PrismaClient();
const parseNutrient = (val) => {
    if (!val || val.trim() === "-" || val.includes("<") || val === "traces")
        return 0;
    const parsed = parseFloat(val.replace(",", "."));
    return isNaN(parsed) ? 0 : parsed;
};
// Exporte la fonction en prenant prisma en paramètre
async function seedCiqual(prisma) {
    console.log("1. Chargement du fichier CSV en mémoire...");
    const fileContent = fs_1.default.readFileSync("prisma/Table Ciqual 2025_FR_2025_11_03.csv", "utf-8");
    console.log("2. Découpage des lignes...");
    const records = (0, sync_1.parse)(fileContent, {
        columns: true,
        skip_empty_lines: true,
        delimiter: ",",
    });
    console.log(`3. ${records.length} lignes trouvées. Début de l'insertion...`);
    // console.log(records[0]);
    let count = 0;
    for (const row of records) {
        if (!row["alim_code"])
            continue;
        const item = {
            id: parseInt(row["alim_code"]),
            name: row["alim_nom_fr"],
            kcalPer100g: parseNutrient(row["Energie,\nRèglement\nUE N°\n1169\n2011 (kcal\n100 g)"]),
            proteins: parseNutrient(row["Protéines,\nN x 6.25\n(g\n100 g)"]),
            carbs: parseNutrient(row["Glucides\n(g\n100 g)"]),
            fats: parseNutrient(row["Lipides\n(g\n100 g)"]),
        };
        await prisma.ciqualItem.upsert({
            where: { id: item.id },
            update: item,
            create: item,
        });
        count++;
        if (count % 500 === 0) {
            console.log(`... ${count} aliments insérés`);
        }
    }
    console.log("✅ Insertion CIQUAL terminée avec succès !");
}
// Supprime l'exécution main().catch(...) à la fin du fichier
