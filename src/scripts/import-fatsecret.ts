import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";

const MEAL_MAP: Record<string, any> = {
  "petit déjeuner": "BREAKFAST",
  "déjeuner": "LUNCH",
  "dîner": "DINNER",
  "snacks/autre": "SNACK",
};

const MONTHS_FR: Record<string, number> = {
  "janvier": 0, "février": 1, "mars": 2, "avril": 3, "mai": 4, "juin": 5,
  "juillet": 6, "août": 7, "septembre": 8, "octobre": 9, "novembre": 10, "décembre": 11
};

async function importFatSecret() {
  const filePath = process.argv[2];
  const userId = process.argv[3];

  if (!filePath || !userId) {
    console.error("❌ Usage: npx tsx src/scripts/import-fatsecret.ts <fichier.csv> <userId>");
    process.exit(1);
  }

  const content = fs.readFileSync(path.resolve(filePath), "utf-8");
  const lines = content.split(/\r?\n/);
  
  // On initialise à midi pour éviter les sauts de journée UTC
  let currentDate = new Date();
  currentDate.setHours(12, 0, 0, 0);

  let currentMeal: any = "SNACK";
  let count = 0;
  let currentDayCount = 0;

  console.log(`🚀 Analyse du fichier pour l'utilisateur ${userId}...`);

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith("Date,") || cleanLine.startsWith("\"Total")) continue;
    
    if (cleanLine.startsWith('"') && cleanLine.endsWith('"')) {
      cleanLine = cleanLine.substring(1, cleanLine.length - 1);
    }
    cleanLine = cleanLine.replace(/""/g, '"');

    // 2. Détection de la DATE (ex: samedi, mars 21, 2026,2863,...)
    const dateMatch = cleanLine.match(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche),\s+([a-zéû]+)\s+(\d+),\s+(\d+)/i);
    if (dateMatch) {
      if (count > 0 && currentDayCount > 0) {
          console.log(`📅 Jour précédent terminé : ${currentDayCount} aliments ajoutés.`);
      }
      const [_, dayName, monthName, day, year] = dateMatch;
      // On crée la date à MIDI (12h) UTC pour être sûr qu'elle reste sur le bon jour calendaire
      currentDate = new Date(Date.UTC(parseInt(year), MONTHS_FR[monthName.toLowerCase()] || 0, parseInt(day), 12, 0, 0));
      currentMeal = "SNACK";
      currentDayCount = 0;
      continue;
    }

    const mealParts = cleanLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (mealParts.length < 2) continue;

    const firstCol = mealParts[0];

    // 3. Détection du REPAS
    if (firstCol.startsWith(" ") && !firstCol.startsWith("  ")) {
      const potentialMeal = firstCol.trim().toLowerCase();
      if (MEAL_MAP[potentialMeal]) {
        currentMeal = MEAL_MAP[potentialMeal];
      }
      continue;
    }

    // 4. Détection d'un ALIMENT
    if (firstCol.startsWith("  ")) {
      let name = firstCol.trim();
      if (name.startsWith('"') && name.endsWith('"')) {
          name = name.substring(1, name.length - 1);
      }
      
      const kcalStr = mealParts[1];
      if (name && kcalStr) {
        let cleanKcalStr = kcalStr.replace(/"/g, "").replace(",", ".");
        const kcal = parseFloat(cleanKcalStr);
        
        if (!isNaN(kcal) && kcal > 0) {
          try {
            await prisma.mealLog.create({
              data: {
                userId,
                name: name,
                source: "CUSTOM",
                mealType: currentMeal,
                quantityGrams: 0,
                totalCalories: kcal,
                consumedAt: currentDate,
              },
            });
            count++;
            currentDayCount++;
          } catch (err) {
            console.error(`❌ Erreur pour ${name}:`, err);
          }
        }
      }
    }
  }

  console.log(`\n✅ Terminé ! ${count} aliments importés avec succès.`);
}

importFatSecret()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
