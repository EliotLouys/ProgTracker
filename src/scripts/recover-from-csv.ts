import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MONTHS_FR: Record<string, number> = {
  "janvier": 0, "février": 1, "mars": 2, "avril": 3, "mai": 4, "juin": 5,
  "juillet": 6, "août": 7, "septembre": 8, "octobre": 9, "novembre": 10, "décembre": 11
};

async function recoverFromCSV() {
  const files = [
    "prisma/Journal_Alimentaire_avril_2026.csv",
    "prisma/Journal_Alimentaire_mars_2026.csv"
  ];

  console.log("🚀 Starting Precise Macronutrient Recovery from CSV (v3)...");

  let totalUpdated = 0;

  for (const relativePath of files) {
    const filePath = path.resolve(relativePath);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ Skipping ${relativePath} (not found)`);
      continue;
    }

    console.log(`\n📄 Processing ${relativePath}...`);
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    
    let currentDate: Date | null = null;
    let currentDayUpdated = 0;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line || line.startsWith("Date,") || line.startsWith("\"Total")) continue;
      
      // Remove surrounding quotes if present
      if (line.startsWith('"') && line.endsWith('"')) {
        line = line.substring(1, line.length - 1);
      }
      // Replace double quotes with single for easier splitting
      line = line.replace(/""/g, '"');

      // 1. Detect DATE
      const dateMatch = line.match(/^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche),\s+([a-zéû]+)\s+(\d+),\s+(\d+)/i);
      if (dateMatch) {
        const [_, dayName, monthName, day, year] = dateMatch;
        currentDate = new Date(Date.UTC(parseInt(year), MONTHS_FR[monthName.toLowerCase()] || 0, parseInt(day), 12, 0, 0));
        continue;
      }

      if (!currentDate) continue;

      // 2. Detect Food Item (Must start with exactly 2 spaces)
      if (!line.startsWith("  ")) continue;

      // Split CSV line
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (parts.length < 8) continue;

      const cleanName = parts[0].trim().replace(/^"/, "").replace(/"$/, "");
      const kcalStr = parts[1].replace(/"/g, "").replace(",", ".");
      const fatsStr = parts[2].replace(/"/g, "").replace(",", ".");
      const carbsStr = parts[4].replace(/"/g, "").replace(",", ".");
      const proteinsStr = parts[7].replace(/"/g, "").replace(",", ".");

      const kcal = parseFloat(kcalStr);
      const fats = parseFloat(fatsStr);
      const carbs = parseFloat(carbsStr);
      const proteins = parseFloat(proteinsStr);

      if (isNaN(kcal)) continue;

      // 3. Find matching MealLog in DB
      const startOfDay = new Date(currentDate);
      startOfDay.setUTCHours(0,0,0,0);
      const endOfDay = new Date(currentDate);
      endOfDay.setUTCHours(23,59,59,999);

      const match = await prisma.mealLog.findFirst({
        where: {
          name: cleanName,
          consumedAt: { gte: startOfDay, lte: endOfDay },
          totalCalories: { gte: kcal - 2, lte: kcal + 2 },
          // Check if at least one macro is null
          OR: [
            { proteins: null },
            { carbs: null },
            { fats: null },
          ]
        }
      });

      if (match) {
        await prisma.mealLog.update({
          where: { id: match.id },
          data: {
            proteins: isNaN(proteins) ? null : proteins,
            carbs: isNaN(carbs) ? null : carbs,
            fats: isNaN(fats) ? null : fats,
          }
        });
        totalUpdated++;
        currentDayUpdated++;
      }
    }
    console.log(`✅ Updated ${currentDayUpdated} items from this file.`);
  }

  console.log(`\n📊 Recovery Complete! Total records fixed: ${totalUpdated}\n`);
  await prisma.$disconnect();
}

recoverFromCSV().catch(async (e) => {
  console.error("Fatal error:", e);
  await prisma.$disconnect();
  process.exit(1);
});
