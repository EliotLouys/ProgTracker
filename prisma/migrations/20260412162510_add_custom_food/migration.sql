-- AlterEnum
ALTER TYPE "DataSource" ADD VALUE 'USER_FOOD';

-- CreateTable
CREATE TABLE "CustomFood" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kcalPer100g" DOUBLE PRECISION NOT NULL,
    "proteins" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fats" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomFood_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomFood_userId_name_idx" ON "CustomFood"("userId", "name");

-- AddForeignKey
ALTER TABLE "CustomFood" ADD CONSTRAINT "CustomFood_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
