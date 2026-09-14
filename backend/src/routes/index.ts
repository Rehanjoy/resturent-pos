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
import websiteRoutes from "./website.routes";
import whatsappConfigRoutes from "./whatsapp-config.routes";
import contactRoutes from "./contact.routes";
import messageTemplateRoutes from "./message-template.routes";
import marketingCampaignRoutes from "./marketing-campaign.routes";
import aiConfigRoutes from "./ai-config.routes";
import conversationRoutes from "./conversation.routes";
import diningRoutes from "./dining.routes";
import customerRoutes from "./customer.routes";
import serviceRequestRoutes from "./service-request.routes";
import productionRoutes from "./production.routes";
import costingRoutes from "./costing.routes";

const router = Router();

router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use("/areas", areaRoutes);
router.use("/tables", tableRoutes);
router.use("/dining", diningRoutes);
router.use("/customers", customerRoutes);
router.use("/service-requests", serviceRequestRoutes);
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
router.use("/inventory/production", productionRoutes);
router.use("/inventory/costing", costingRoutes);
router.use("/reservations", reservationRoutes);
router.use("/website", websiteRoutes);
// Marketing module. Part 1 shipped WhatsApp connection config + Contacts;
// Part 2 added Templates (read-only Meta template cache) and Campaigns
// (broadcast + delivery tracking). Part 3 (this pass) adds the AI
// auto-reply Inbox: `ai-config` (Gemini key + auto-reply settings) and
// `conversations` (the Inbox list/detail/reply/close/hand-back-to-bot
// endpoints). Same "one router file per resource, all under one
// `/marketing` prefix" convention throughout — the public webhook that
// feeds both Campaigns' delivery status and the Inbox's inbound messages
// is a separate router entirely (`whatsapp-webhook.routes.ts`, mounted
// under `/api/public` in `public.routes.ts`, never here).
router.use("/marketing/whatsapp-config", whatsappConfigRoutes);
router.use("/marketing/contacts", contactRoutes);
router.use("/marketing/templates", messageTemplateRoutes);
router.use("/marketing/campaigns", marketingCampaignRoutes);
router.use("/marketing/ai-config", aiConfigRoutes);
router.use("/marketing/conversations", conversationRoutes);

export default router;
