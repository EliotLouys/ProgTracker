import { PrismaClient } from "@prisma/client";
import fs from "fs";
import { parse } from "csv-parse/sync"; // Version synchrone

const prisma = new PrismaClient();

// Fonction de nettoyage des valeurs (garde la même logique)
const parseNutrient = (val: string): number => {
  if (!val || val.trim() === "-" || val.includes("<") || val === "traces")
    return 0;
  const parsed = parseFloat(val.replace(",", "."));
  return isNaN(parsed) ? 0 : parsed;
};

async function main() {
  console.log("1. Chargement du fichier CSV en mémoire...");
  // fs.readFileSync bloque l'exécution tant que le fichier n'est pas lu (comportement séquentiel)
  const fileContent = fs.readFileSync(
    "prisma/Table Ciqual 2025_FR_2025_11_03.csv",
    "utf-8",
  );

  console.log("2. Découpage des lignes...");
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ",",
  }) as Record<string, string>[];

  console.log(`3. ${records.length} lignes trouvées. Début de l'insertion...`);

  // Boucle classique : on attend (await) que chaque ligne soit insérée avant de passer à la suivante
  let count = 0;
  for (const row of records) {
    if (!row["alim_code"]) continue;

    const item = {
      id: parseInt(row["alim_code"]),
      name: row["alim_nom_fr"],
      kcalPer100g: parseNutrient(
        row["Energie, Règlement UE N° 1169/2011 (kcal/100 g)"],
      ),
      proteins: parseNutrient(row["Protéines, N x 6.25 (g/100 g)"]),
      carbs: parseNutrient(row["Glucides (g/100 g)"]),
      fats: parseNutrient(row["Lipides (g/100 g)"]),
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

  console.log("✅ Insertion terminée avec succès !");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
