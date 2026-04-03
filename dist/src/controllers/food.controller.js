"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchCiqual = exports.getByBarcode = void 0;
const prisma_1 = require("../lib/prisma");
const openfoodfacts_service_1 = require("../services/openfoodfacts.service");
const getByBarcode = async (req, res) => {
    const product = await (0, openfoodfacts_service_1.fetchOFFProduct)(req.params.code);
    product ? res.json(product) : res.status(404).json({ error: "Not found" });
};
exports.getByBarcode = getByBarcode;
const searchCiqual = async (req, res) => {
    const results = await prisma_1.prisma.ciqualItem.findMany({
        where: { name: { contains: req.query.q, mode: "insensitive" } },
        take: 10,
    });
    res.json(results);
};
exports.searchCiqual = searchCiqual;
