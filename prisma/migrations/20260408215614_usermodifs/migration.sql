-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHTLY_ACTIVE', 'MODERATELY_ACTIVE', 'VERY_ACTIVE', 'EXTRA_ACTIVE');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- AlterTable
ALTER TABLE "MealLog" ADD COLUMN     "mealType" "MealType" NOT NULL DEFAULT 'SNACK';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activityLevel" "ActivityLevel" DEFAULT 'SEDENTARY',
ADD COLUMN     "age" INTEGER,
ADD COLUMN     "gender" "Gender" DEFAULT 'MALE',
ADD COLUMN     "heightCm" DOUBLE PRECISION,
ADD COLUMN     "weightKg" DOUBLE PRECISION;
