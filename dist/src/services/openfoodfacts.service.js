"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchOFFProduct = void 0;
const axios_1 = __importDefault(require("axios"));
const fetchOFFProduct = async (barcode) => {
    const resp = await axios_1.default.get(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    if (resp.data.status === 0)
        return null;
    const p = resp.data.product;
    return {
        name: p.product_name,
        kcalPer100g: p.nutriments["energy-kcal_100g"] || 0,
        proteins: p.nutriments.proteins_100g || 0,
        carbs: p.nutriments.carbohydrates_100g || 0,
        fats: p.nutriments.fat_100g || 0,
    };
};
exports.fetchOFFProduct = fetchOFFProduct;
