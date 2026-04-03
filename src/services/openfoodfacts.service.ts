import axios from "axios";

export const fetchOFFProduct = async (barcode: string) => {
  const resp = await axios.get(
    `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
  );
  if (resp.data.status === 0) return null;
  const p = resp.data.product;
  return {
    name: p.product_name,
    kcalPer100g: p.nutriments["energy-kcal_100g"] || 0,
    proteins: p.nutriments.proteins_100g || 0,
    carbs: p.nutriments.carbohydrates_100g || 0,
    fats: p.nutriments.fat_100g || 0,
  };
};
