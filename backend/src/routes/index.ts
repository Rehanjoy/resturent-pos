import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import areaRoutes from "./area.routes";
import tableRoutes from "./table.routes";
import categoryRoutes from "./category.routes";
import menuItemRoutes from "./menu-item.routes";

const router = Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use("/areas", areaRoutes);
router.use("/tables", tableRoutes);
router.use("/categories", categoryRoutes);
router.use("/menu-items", menuItemRoutes);

// Feature routes (orders, kitchen, billing, staff, reports, etc.) are
// added here in later parts of the build.

export default router;
