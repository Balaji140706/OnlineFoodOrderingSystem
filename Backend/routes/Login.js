import express from "express";

import {
    CreateAccountController,
    LoginController,
    LogoutController,
    RefreshTokenController,
    DeleteAccountController
} from "../controllers/Login.js";

import authenticate from "../middleware/authenticate.js";

const router = express.Router();

router.post("/CreateAccount", CreateAccountController);

router.post("/Login", LoginController);

router.post("/Logout", LogoutController);

router.post("/RefreshToken", RefreshTokenController);

router.delete(
    "/DeleteAccount",
    authenticate(["customer","restaurant","delivery"]),
    DeleteAccountController
);

export default router;