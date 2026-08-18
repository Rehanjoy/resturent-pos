import { Router } from "express";
import * as reservationController from "../controllers/reservation.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import {
  createReservationSchema,
  reservationIdParamsSchema,
  reservationListQuerySchema,
  seatReservationSchema,
  updateReservationSchema,
} from "../validators/reservation.validators";

const router = Router();

router.use(authenticate);

// PRD §2's combined "Tables/Reservation" RBAC column: Owner/Manager Full;
// Cashier View; Server/Waiter Create/Edit; Chef and Inventory Manager have
// no access at all (no route below is reachable by either role).
//
// `canView` is deliberately the broader set (adds Cashier, who can only
// view) while `canBuild` covers every write path — create, the general
// edit, cancel/no-show (also just a status edit, see
// `reservation.validators.ts` `updateReservationSchema`), delete, and seat
// — restricted to Owner/Manager/Server, matching the PRD's "Create/Edit"
// wording for Server and excluding Cashier from writes (View only). Same
// view/build split shape `table.routes.ts` already uses for its
// canView/canManage/canChangeStatus guards.
//
// Cancel isn't given a tighter gate than create/edit: unlike order-void
// (PRD explicitly restricts that to Owner/Manager), the PRD doesn't call
// out a stricter rule for cancelling a reservation, so it stays on the
// same `canBuild` gate as everything else for consistency.
const canView = authorize("owner", "manager", "cashier", "server");
const canBuild = authorize("owner", "manager", "server");

router.get(
  "/",
  canView,
  validate(reservationListQuerySchema, "query"),
  reservationController.listReservations,
);
router.get(
  "/:id",
  canView,
  validate(reservationIdParamsSchema, "params"),
  reservationController.getReservation,
);
router.post(
  "/",
  canBuild,
  validate(createReservationSchema),
  reservationController.createReservation,
);
router.patch(
  "/:id",
  canBuild,
  validate(reservationIdParamsSchema, "params"),
  validate(updateReservationSchema),
  reservationController.updateReservation,
);
router.delete(
  "/:id",
  canBuild,
  validate(reservationIdParamsSchema, "params"),
  reservationController.deleteReservation,
);
router.patch(
  "/:id/seat",
  canBuild,
  validate(reservationIdParamsSchema, "params"),
  validate(seatReservationSchema),
  reservationController.seatReservation,
);

export default router;
