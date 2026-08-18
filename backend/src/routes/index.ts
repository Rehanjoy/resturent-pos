import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";

const router = Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);

// Feature routes (orders, kitchen, tables, menu, billing, staff, reports,
// etc.) are added here in later parts of the build.

export default router;
