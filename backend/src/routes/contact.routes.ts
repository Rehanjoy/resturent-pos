import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import * as contactController from "../controllers/contact.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validate } from "../middleware/validate";
import { AppError } from "../utils/app-error";
import {
  contactIdParamsSchema,
  createContactSchema,
  listContactsQuerySchema,
  updateContactSchema,
} from "../validators/contact.validators";

const router = Router();

router.use(authenticate);

// Marketing module is Owner/Manager only end to end — see
// `whatsapp-config.routes.ts` for the same gate. No manage/view split here
// (unlike WhatsApp connection): both roles can fully manage contacts.
const canAccess = authorize("owner", "manager");

// In-memory storage, no disk writes — the raw bytes are only needed
// momentarily to parse CSV rows (`contact.service.ts`
// `importContactsFromCsv`), never to persist the uploaded file itself.
// Small size cap so a huge upload can't exhaust server memory.
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/** Wraps `csvUpload.single("file")` so a Multer failure (oversized file,
 * wrong field name) becomes a normal `AppError` — Multer's own errors
 * would otherwise fall through the central error handler as an
 * un-recognized 500, hiding a client-fixable problem (PRD-equivalent "no
 * error, no bug" — every failure path must produce a clear message). */
function handleCsvUpload(req: Request, res: Response, next: NextFunction): void {
  csvUpload.single("file")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE" ? "CSV file must be 5MB or smaller." : error.message;
      next(new AppError(message, 400, "CSV_UPLOAD_ERROR"));
      return;
    }
    next(error);
  });
}

router.get("/", canAccess, validate(listContactsQuerySchema, "query"), contactController.listContacts);
router.post("/", canAccess, validate(createContactSchema), contactController.createContact);
router.post("/import", canAccess, handleCsvUpload, contactController.importContacts);
router.patch(
  "/:id",
  canAccess,
  validate(contactIdParamsSchema, "params"),
  validate(updateContactSchema),
  contactController.updateContact,
);
router.delete(
  "/:id",
  canAccess,
  validate(contactIdParamsSchema, "params"),
  contactController.deleteContact,
);

export default router;
