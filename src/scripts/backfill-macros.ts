import { PrismaClient } from "@prisma/client";
import { fetchOFFProduct, searchOFFProducts } from "../services/openfoodfacts.service";

const prisma = new PrismaClient();

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function backfillMacros() {
  console.log("🚀 Starting Macronutrient Recovery Script (v2.1 - with Delay)...");

  // 1. Identify meals with missing macros
  const missingMeals = await prisma.mealLog.findMany({
    where: {
      OR: [
        { proteins: null },
        { carbs: null },
        { fats: null },
      ],
    },
  });

  console.log(`🔍 Found ${missingMeals.length} meals to process.`);

  let successCount = 0;
  let failCount = 0;

  for (const meal of missingMeals) {
    await sleep(600); // 0.6s delay to avoid 503 from OFF
    process.stdout.write(`⏳ Recovering [${meal.name}] (${meal.source})... `);

    let macrosPer100g = null;

    try {
      // --- CASE A: Source with ID available ---
      if (meal.source === "OPEN_FOOD_FACTS" && meal.externalId) {
        macrosPer100g = await fetchOFFProduct(meal.externalId);
      } 
      else if (meal.source === "CIQUAL" && meal.externalId) {
        const item = await prisma.ciqualItem.findUnique({
          where: { id: parseInt(meal.externalId) },
        });
        if (item) macrosPer100g = item;
      } 
      else if ((meal.source === "USER_FOOD" || meal.source === "CUSTOM") && meal.externalId) {
        const item = await prisma.customFood.findUnique({
          where: { id: meal.externalId },
        });
        if (item) macrosPer100g = item;
      } 
      else if (meal.source === "RECIPE" && meal.externalId) {
        const item = await prisma.recipe.findUnique({
          where: { id: meal.externalId },
        });
        if (item) macrosPer100g = item;
      }

      // --- CASE B: Source CUSTOM without ID (Imported data) ---
      if (!macrosPer100g && meal.name) {
        // Try searching CIQUAL first (cleaner data, no rate limit)
        const ciqualMatch = await prisma.ciqualItem.findFirst({
          where: { name: { contains: meal.name, mode: 'insensitive' } }
        });

        if (ciqualMatch) {
          macrosPer100g = ciqualMatch;
        } else {
          // Try searching OFF
          const offResults = await searchOFFProducts(meal.name);
          if (offResults && offResults.length > 0) {
            macrosPer100g = offResults[0]; 
          }
        }
      }

      if (macrosPer100g && macrosPer100g.kcalPer100g > 0) {
        let qty = meal.quantityGrams;
        if (qty <= 0) {
          qty = (meal.totalCalories * 100) / macrosPer100g.kcalPer100g;
        }

        await prisma.mealLog.update({
          where: { id: meal.id },
          data: {
            quantityGrams: qty,
            proteins: macrosPer100g.proteins !== null ? (macrosPer100g.proteins * qty) / 100 : null,
            carbs: macrosPer100g.carbs !== null ? (macrosPer100g.carbs * qty) / 100 : null,
            fats: macrosPer100g.fats !== null ? (macrosPer100g.fats * qty) / 100 : null,
          },
        });
        console.log("✅ Recovered");
        successCount++;
      } else {
        console.log("❌ Not found");
        failCount++;
      }
    } catch (err: any) {
      console.log(`❌ Error: ${err.message}`);
      failCount++;
    }
  }

  console.log("\n----------------------------------");
  console.log(`📊 Recovery Complete!`);
  console.log(`✅ Recovered: ${successCount}`);
  console.log(`❌ Skipped: ${failCount}`);
  console.log("----------------------------------\n");

  await prisma.$disconnect();
}

backfillMacros();
