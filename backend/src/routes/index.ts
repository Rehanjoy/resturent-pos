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
import dashboardRoutes from "./dashboard.routes";
import reportRoutes from "./report.routes";
import inventoryCategoryRoutes from "./inventory-category.routes";
import inventoryItemRoutes from "./inventory-item.routes";
import supplierRoutes from "./supplier.routes";
import inventoryTransactionRoutes from "./inventory-transaction.routes";
import reservationRoutes from "./reservation.routes";

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
router.use("/dashboard", dashboardRoutes);
router.use("/reports", reportRoutes);
router.use("/inventory/categories", inventoryCategoryRoutes);
router.use("/inventory/items", inventoryItemRoutes);
router.use("/inventory/suppliers", supplierRoutes);
router.use("/inventory/transactions", inventoryTransactionRoutes);
router.use("/reservations", reservationRoutes);

// Feature routes (website builder, etc. — Phase 2) are added here in later
// parts of the build.

export default router;
