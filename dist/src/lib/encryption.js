"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = void 0;
const crypto_js_1 = __importDefault(require("crypto-js"));
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY && process.env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY must be set in production");
}
// Fallback for development if not set
const KEY = ENCRYPTION_KEY || "dev-secret-key-change-me";
const encrypt = (text) => {
    if (!text)
        return null;
    return crypto_js_1.default.AES.encrypt(text, KEY).toString();
};
exports.encrypt = encrypt;
const decrypt = (ciphertext) => {
    if (!ciphertext)
        return null;
    try {
        const bytes = crypto_js_1.default.AES.decrypt(ciphertext, KEY);
        const originalText = bytes.toString(crypto_js_1.default.enc.Utf8);
        if (!originalText)
            return null;
        return originalText;
    }
    catch (e) {
        console.error("Decryption failed", e);
        return null;
    }
};
exports.decrypt = decrypt;
