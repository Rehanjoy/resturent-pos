import { Router, type RequestHandler } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { diningReadRateLimiter, diningWriteRateLimiter } from "../middleware/rate-limit";
import { AppError } from "../utils/app-error";
import { qrParams } from "../validators/dining.validators";
import * as validators from "../validators/service-request.validators";
import * as controller from "../controllers/service-request.controller";

const requireDiningToken: RequestHandler = (req, _res, next) => {
  if (!validators.serviceRequestToken.safeParse(req.get("X-Dining-Token")).success) {
    return next(new AppError("Scan and reserve your chair first.", 401, "DINING_SESSION_REQUIRED"));
  }
  next();
};
export const publicServiceRequestRoutes = Router();
const guestValidation = [validate(qrParams, "params"), requireDiningToken, validate(validators.emptyServiceRequestQuery, "query")];
publicServiceRequestRoutes.get("/:qrToken/service-requests", diningReadRateLimiter, ...guestValidation, controller.listGuestRequests);
publicServiceRequestRoutes.post("/:qrToken/service-requests", diningWriteRateLimiter, ...guestValidation, validate(validators.serviceRequestBody), controller.createGuestRequest);

const router = Router();
router.use(authenticate, authorize("owner", "manager", "server", "cashier"));
router.get("/", validate(validators.emptyServiceRequestQuery, "query"), controller.listStaffRequests);
router.patch("/:id", validate(validators.serviceRequestIdParams, "params"), validate(validators.emptyServiceRequestQuery, "query"), validate(validators.serviceRequestStatusBody), controller.updateRequest);
export default router;
