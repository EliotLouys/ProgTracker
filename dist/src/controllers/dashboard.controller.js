"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivities = exports.getDashboard = void 0;
const prisma_1 = require("../lib/prisma");
const dashboardService = __importStar(require("../services/dashboard.service"));
const getDashboard = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    const { startDate, endDate, sport, excludeFuture } = req.query;
    try {
        const stats = await dashboardService.getDashboardStats(req.userId, startDate, endDate, sport, excludeFuture === 'true');
        return res.json(stats);
    }
    catch (error) {
        console.error("[DashboardController] Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
};
exports.getDashboard = getDashboard;
const getActivities = async (req, res) => {
    if (!req.userId)
        return res.sendStatus(401);
    const activities = await prisma_1.prisma.activity.findMany({
        where: { userId: req.userId },
        orderBy: { startDate: "desc" },
        take: 100,
    });
    res.json(activities.map((activity) => ({
        id: Number(activity.id),
        name: activity.name,
        distance: activity.distance,
        moving_time: activity.movingTime,
        total_elevation_gain: 0,
        start_date: activity.startDate.toISOString(),
        type: activity.type,
        calories: activity.calories,
    })));
};
exports.getActivities = getActivities;
