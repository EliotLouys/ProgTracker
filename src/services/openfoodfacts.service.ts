import axios from "axios";

/**
 * Open Food Facts API Service
 * Utilise l'API v2 (plus moderne et stable)
 * Doc: https://openfoodfacts.github.io/api-documentation/
 */

const offApi = axios.create({
  baseURL: "https://world.openfoodfacts.org",
  timeout: 10000,
  headers: {
    // Format recommandé: AppName/Version (Contact)
    "User-Agent": "Stravoupsi/1.0 (https://github.com/votre-repo/stravoupsi)",
    "Content-Type": "application/json",
  },
});

// Helper pour l'authentification (utile surtout pour les contributions, mais recommandé)
const getAuthParams = () => {
  const user = process.env.OFF_USERNAME;
  const pass = process.env.OFF_PASSWORD;
  return user && pass ? { user_id: user, password: pass } : {};
};

export const fetchOFFProduct = async (barcode: string) => {
  try {
    // API v2 pour la récupération d'un produit
    const resp = await offApi.get(`/api/v2/product/${barcode}.json`, {
      params: {
        fields: "product_name,nutriments,code",
        ...getAuthParams()
      }
    });

    if (resp.data.status === "failure") return null;
    
    const p = resp.data.product;
    if (!p) return null;

    return {
      name: p.product_name || "Produit inconnu",
      kcalPer100g: p.nutriments?.["energy-kcal_100g"] || 0,
      proteins: p.nutriments?.proteins_100g || 0,
      carbs: p.nutriments?.carbohydrates_100g || 0,
      fats: p.nutriments?.fat_100g || 0,
    };
  } catch (err: any) {
    parseOFFError(err, "Fetch Barcode");
    return null;
  }
};

export const searchOFFProducts = async (query: string) => {
  try {
    /**
     * API v2 Search
     * Plus rapide et supporte mieux le filtrage
     */
    const resp = await offApi.get("/api/v2/search", {
      params: {
        categories_tags: "", // On cherche globalement
        search_terms: query,
        fields: "code,product_name,nutriments",
        page_size: 10,
        ...getAuthParams()
      }
    });

    if (!resp.data.products) return [];

    return resp.data.products
      .map((p: any) => ({
        externalId: p.code,
        name: p.product_name,
        kcalPer100g: p.nutriments?.["energy-kcal_100g"] || 0,
        proteins: p.nutriments?.proteins_100g || null,
        carbs: p.nutriments?.carbohydrates_100g || null,
        fats: p.nutriments?.fat_100g || null,
        source: "OPEN_FOOD_FACTS",
      }))
      .filter((p: any) => p.name);
  } catch (err: any) {
    parseOFFError(err, "Search Text");
    return [];
  }
};

const parseOFFError = (err: any, context: string) => {
  const status = err.response?.status;
  const message = err.message;
  
  if (status === 503 || status === 429) {
    console.error(`[OFF ${context}] ❌ RATE LIMIT / BAN : Trop de requêtes (Status ${status}).`);
  } else if (status === 403) {
    console.error(`[OFF ${context}] ❌ FORBIDDEN : Vérifiez le User-Agent ou l'Auth (Status 403).`);
  } else {
    console.error(`[OFF ${context}] ❌ ERREUR : ${message} (Status: ${status || "N/A"})`);
  }
};
