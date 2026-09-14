import { Router, type RequestHandler } from "express";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { diningReadRateLimiter, diningWriteRateLimiter } from "../middleware/rate-limit";
import { AppError } from "../utils/app-error";
import * as controller from "../controllers/notification.controller";
import * as validators from "../validators/notification.validators";
import { serviceRequestToken } from "../validators/service-request.validators";

const requireDiningToken: RequestHandler = (req, _res, next) => {
  if (!serviceRequestToken.safeParse(req.get("X-Dining-Token")).success) return next(new AppError("Scan and reserve your chair first.", 401, "DINING_SESSION_REQUIRED"));
  next();
};

export const publicNotificationRoutes = Router();
publicNotificationRoutes.get("/:qrToken/notifications", diningReadRateLimiter, validate(validators.guestNotificationParams, "params"), requireDiningToken, validate(validators.guestNotificationQuery, "query"), controller.listGuest);
publicNotificationRoutes.patch("/:qrToken/notifications/:id/read", diningWriteRateLimiter, validate(validators.guestNotificationParams, "params"), requireDiningToken, controller.markGuestRead);

const router = Router();
router.use(authenticate);
router.get("/", validate(validators.notificationListQuery, "query"), controller.listStaff);
router.get("/unread-counts", controller.unreadCounts);
router.patch("/:id/read", validate(validators.notificationIdParams, "params"), controller.markStaffRead);
router.post("/read-all", controller.markAllStaffRead);
export default router;
