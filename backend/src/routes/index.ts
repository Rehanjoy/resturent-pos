import { Router } from "express";
import healthRoutes from "./health.routes";

const router = Router();

router.use(healthRoutes);

// Feature routes (auth, orders, kitchen, tables, menu, billing, staff,
// reports, etc.) are added here in later parts of the build.

export default router;
