import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { authRateLimiter, loginRateLimiter } from "../middleware/rate-limit";
import {
  loginSchema,
  pinLoginSchema,
  pinLoginStaffQuerySchema,
  resetPasswordSchema,
  twoFactorEnableSchema,
  twoFactorVerifySchema,
} from "../validators/auth.validators";

const router = Router();

router.use(authRateLimiter);

// Pre-authentication (public) routes — see docs/03-wireframes/login.html.
router.get(
  "/pin-login/staff",
  validate(pinLoginStaffQuerySchema, "query"),
  authController.listPinLoginStaff,
);
router.post("/login", loginRateLimiter, validate(loginSchema), authController.login);
router.post(
  "/pin-login",
  loginRateLimiter,
  validate(pinLoginSchema),
  authController.pinLogin,
);
router.post(
  "/2fa/verify",
  loginRateLimiter,
  validate(twoFactorVerifySchema),
  authController.verifyTwoFactor,
);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

// Authenticated routes.
router.get("/me", authenticate, authController.me);
router.post("/2fa/setup", authenticate, authController.setupTwoFactor);
router.post(
  "/2fa/enable",
  authenticate,
  validate(twoFactorEnableSchema),
  authController.enableTwoFactor,
);
router.post(
  "/reset-password",
  authenticate,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

export default router;
