import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import areaRoutes from "./area.routes";
import tableRoutes from "./table.routes";
import categoryRoutes from "./category.routes";
import menuItemRoutes from "./menu-item.routes";
import orderRoutes from "./order.routes";
import kitchenRoutes from "./kitchen.routes";
import invoiceRoutes from "./invoice.routes";
import paymentRoutes from "./payment.routes";
import staffRoutes from "./staff.routes";
import settingsRoutes from "./settings.routes";

const router = Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use("/areas", areaRoutes);
router.use("/tables", tableRoutes);
router.use("/categories", categoryRoutes);
router.use("/menu-items", menuItemRoutes);
router.use("/orders", orderRoutes);
router.use("/kitchen", kitchenRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/payments", paymentRoutes);
router.use("/staff", staffRoutes);
router.use("/settings", settingsRoutes);

// Feature routes (reports, website builder, etc.) are added here in later
// parts of the build.

export default router;
