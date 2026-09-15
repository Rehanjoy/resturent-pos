import { Router } from "express";
import multer from "multer";
import * as mediaController from "../controllers/media.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { AppError } from "../utils/app-error";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, done) => done(null, ALLOWED_TYPES.has(file.mimetype)),
});

const router = Router();
router.use(authenticate);
router.post("/menu-image", authorize("owner", "manager"), (req, res, next) => {
  upload.single("image")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(new AppError(error.code === "LIMIT_FILE_SIZE" ? "Image must be 3 MB or smaller." : "Could not upload this image.", 400, "IMAGE_UPLOAD_ERROR"));
      return;
    }
    if (error) { next(error); return; }
    if (!req.file) { next(new AppError("Choose a JPG, PNG, or WebP image.", 400, "INVALID_IMAGE_TYPE")); return; }
    mediaController.uploadMenuImage(req, res, next);
  });
});

export const publicMediaRoutes = Router();
publicMediaRoutes.get("/:id", mediaController.serveMenuImage);

export default router;
