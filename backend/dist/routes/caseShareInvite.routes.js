"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clinicalCaseShareInvite_controller_1 = require("../controllers/clinicalCaseShareInvite.controller");
const router = (0, express_1.Router)();
router.get('/:token', clinicalCaseShareInvite_controller_1.getCaseShareInvitePublic);
router.post('/:token/sign', clinicalCaseShareInvite_controller_1.signCaseShareInvite);
exports.default = router;
