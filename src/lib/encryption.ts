import CryptoJS from "crypto-js";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY && process.env.NODE_ENV === "production") {
  throw new Error("ENCRYPTION_KEY must be set in production");
}

// Fallback for development if not set
const KEY = ENCRYPTION_KEY || "dev-secret-key-change-me";

export const encrypt = (text: string | null | undefined): string | null => {
  if (!text) return null;
  return CryptoJS.AES.encrypt(text, KEY).toString();
};

export const decrypt = (ciphertext: string | null | undefined): string | null => {
  if (!ciphertext) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (!originalText) return null;
    return originalText;
  } catch (e) {
    console.error("Decryption failed", e);
    return null;
  }
};
