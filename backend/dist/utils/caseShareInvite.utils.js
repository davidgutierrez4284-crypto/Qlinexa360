"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCaseShareToken = generateCaseShareToken;
exports.defaultCaseShareInviteExpiry = defaultCaseShareInviteExpiry;
const crypto_1 = __importDefault(require("crypto"));
const INVITE_DAYS = 14;
function generateCaseShareToken() {
    return crypto_1.default.randomBytes(32).toString('hex');
}
function defaultCaseShareInviteExpiry() {
    const d = new Date();
    d.setDate(d.getDate() + INVITE_DAYS);
    return d;
}
