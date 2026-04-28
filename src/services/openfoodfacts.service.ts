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
    // API v0 est la plus stable pour la récupération d'un produit par code-barres
    const resp = await offApi.get(`/api/v0/product/${barcode}.json`, {
      params: {
        fields: "product_name,nutriments,code",
        ...getAuthParams()
      }
    });

    if (!resp.data || resp.data.status === 0 || resp.data.status === "failure") {
      return null;
    }
    
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
    // Fail silently for the user but log for the dev
    parseOFFError(err, `Fetch Barcode ${barcode}`);
    return null;
  }
};

export const searchOFFProducts = async (query: string) => {
  if (!query || query.trim().length < 3) return [];

  try {
    /**
     * Pour la recherche par mots-clés, cgi/search.pl reste la solution la plus fiable
     * en attendant la stabilisation complète de l'API v3 (Search-a-licious).
     */
    const resp = await offApi.get("/cgi/search.pl", {
      params: {
        search_terms: query,
        search_simple: 1,
        action: "process",
        json: 1,
        fields: "code,product_name,nutriments",
        page_size: 10,
        ...getAuthParams()
      }
    });

    if (!resp.data || !resp.data.products) return [];

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
    // Fail silently for the user but log for the dev
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
