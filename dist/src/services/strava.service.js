"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDetailedActivity = void 0;
const axios_1 = __importDefault(require("axios"));
const getDetailedActivity = async (activityId, accessToken) => {
    const resp = await axios_1.default.get(`https://www.strava.com/api/v3/activities/${activityId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return resp.data;
};
exports.getDetailedActivity = getDetailedActivity;
