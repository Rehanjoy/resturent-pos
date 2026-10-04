import { Types, type PipelineStage } from "mongoose";
import { Contact } from "../models/contact.model";
import { CustomerVisit, type CustomerVisitDocument } from "../models/customer-visit.model";
import type { DiningSession } from "../models/dining-floor.model";
import { Payment } from "../models/payment.model";
import { AppError } from "../utils/app-error";
import { recordAuditLog } from "./audit-log.service";

export function normalizeCustomerPhone(input: string) {
  const cleaned = input.replace(/[\s()-]/g, "");
  const phone = /^[6-9][0-9]{9}$/.test(cleaned) ? `+91${cleaned}` : cleaned;
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) throw new AppError("Enter a valid phone number with country code, or a 10-digit Indian mobile number.", 400, "INVALID_PHONE");
  return phone;
}
export async function linkDiningCustomer(restaurantId: string, input: { name: string; phone: string }) {
  const phone = normalizeCustomerPhone(input.phone);
  // An unauthenticated phone entry never overwrites staff notes, saved identity,
  // or marketing consent. Only the new visit records the entered name.
  const contact = await Contact.findOneAndUpdate({ restaurantId, phone }, { $setOnInsert: {
    restaurantId, phone, name: input.name.trim(), source: "order", optedIn: false, serviceTag: "normal", tags: [],
  } }, { upsert: true, returnDocument: "after" });
  return { contactId: contact!.id, name: input.name.trim(), phone };
}
export async function syncCustomerVisit(restaurantId: string, session: DiningSession) {
  if (!session.customer) return;
  const endedAt = session.status === "expired" ? session.expiresAt : session.cleaningAt ?? session.releasedAt;
  await CustomerVisit.updateOne({ sessionId: session.id, restaurantId }, { $set: {
    status: session.status, expiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
    ...(endedAt ? { endedAt: new Date(endedAt) } : {}), ...(session.orderId ? { orderId: session.orderId } : {}),
  }, $setOnInsert: {
    restaurantId, contactId: session.customer.contactId, sessionId: session.id,
    nameSnapshot: session.customer.name, phoneSnapshot: session.customer.phone,
    partySize: session.partySize, seats: session.seats, source: session.source,
    startedAt: new Date(session.createdAt), amountPaid: 0,
  } }, { upsert: true });
}
export async function recordVisitPayment(restaurantId: string, orderId: string, invoiceId: string, sessionId?: string) {
  const payments = await Payment.find({ restaurantId, invoiceId }).sort({ createdAt: 1 }).lean();
  const visitFilter = sessionId
    ? { restaurantId, $or: [{ orderId }, { sessionId }] }
    : { restaurantId, orderId };
  await CustomerVisit.updateOne(visitFilter, { $set: {
    amountPaid: payments.reduce((total, payment) => total + payment.amount, 0),
    paidAt: payments.length ? payments[payments.length - 1]!.createdAt : undefined,
    orderId,
  } });
}

/** Read the ledger only for visits selected by the caller. Each equality lookup
 * uses its foreign-key index, stays tenant-scoped, and deduplicates order IDs.
 * Historical visits missing orderId are recovered through diningSessionId.
 * Reads never rewrite visit/payment records or scan the restaurant's ledger. */
function visitPaymentStages(restaurantId: Types.ObjectId): PipelineStage[] {
  return [
    { $lookup: {
      from: "orders", localField: "sessionId", foreignField: "diningSessionId",
      pipeline: [{ $match: { restaurantId } }, { $project: { _id: 1 } }], as: "sessionOrders",
    } },
    { $set: { linkedOrderIds: { $setUnion: ["$sessionOrders._id", {
      $cond: [{ $ifNull: ["$orderId", false] }, ["$orderId"], []],
    }] } } },
    { $lookup: {
      from: "invoices", localField: "linkedOrderIds", foreignField: "orderId",
      pipeline: [{ $match: { restaurantId } }, { $project: { _id: 1 } }], as: "visitInvoices",
    } },
    { $lookup: {
      from: "payments", localField: "visitInvoices._id", foreignField: "invoiceId",
      pipeline: [{ $match: { restaurantId } }, {
        $group: { _id: null, amountPaid: { $sum: "$amount" }, paidAt: { $max: "$createdAt" } },
      }], as: "ledgerTotal",
    } },
    { $set: {
      amountPaid: { $ifNull: [{ $arrayElemAt: ["$ledgerTotal.amountPaid", 0] }, "$amountPaid"] },
      paidAt: { $ifNull: [{ $arrayElemAt: ["$ledgerTotal.paidAt", 0] }, "$paidAt"] },
      orderId: { $ifNull: ["$orderId", { $arrayElemAt: ["$linkedOrderIds", 0] }] },
    } },
    { $unset: ["sessionOrders", "linkedOrderIds", "visitInvoices", "ledgerTotal"] },
  ];
}
export async function listCustomers(restaurantId: string, search = "", page = 1) {
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = { restaurantId, ...(search ? { $or: [{ name: { $regex: escaped, $options: "i" } }, { phone: { $regex: escaped } }] } : {}) };
  const [contacts, total] = await Promise.all([Contact.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * 30).limit(30).lean(), Contact.countDocuments(filter)]);
  const summaries = contacts.length ? await CustomerVisit.aggregate<{
    _id: Types.ObjectId; visitCount: number; amountPaid: number; lastVisitAt: Date;
  }>([
    { $match: { restaurantId: new Types.ObjectId(restaurantId), contactId: { $in: contacts.map(c => c._id) } } },
    ...visitPaymentStages(new Types.ObjectId(restaurantId)),
    { $group: { _id: "$contactId", visitCount: { $sum: 1 }, amountPaid: { $sum: "$amountPaid" }, lastVisitAt: { $max: "$startedAt" } } },
  ]) : [];
  return { customers: contacts.map(c => {
    const summary = summaries.find(s => s._id.equals(c._id));
    return { id: c._id.toString(), name: c.name, phone: c.phone, serviceTag: c.serviceTag ?? "normal", serviceNotes: c.serviceNotes ?? "", visitCount: summary?.visitCount ?? 0, amountPaid: summary?.amountPaid ?? 0, lastVisitAt: summary?.lastVisitAt ?? null };
  }), total, page, totalPages: Math.max(1, Math.ceil(total / 30)) };
}
export async function customerDetail(restaurantId: string, id: string) {
  const contact = await Contact.findOne({ _id: id, restaurantId }).lean();
  if (!contact) throw new AppError("Customer not found.", 404, "NOT_FOUND");
  const now = new Date();
  const visits = await CustomerVisit.aggregate<CustomerVisitDocument & { _id: Types.ObjectId }>([
    { $match: { restaurantId: new Types.ObjectId(restaurantId), contactId: new Types.ObjectId(id) } },
    { $sort: { startedAt: -1 } }, { $limit: 100 },
    ...visitPaymentStages(new Types.ObjectId(restaurantId)),
  ]);
  // Expiry is projected for the requested visits; the seating lifecycle owns writes.
  for (const visit of visits) {
    if (visit.status === "held" && visit.expiresAt && visit.expiresAt <= now) {
      visit.status = "expired";
      visit.endedAt = visit.expiresAt;
    }
  }
  return { customer: { id, name: contact.name, phone: contact.phone, serviceTag: contact.serviceTag ?? "normal", serviceNotes: contact.serviceNotes ?? "" },
    visits: visits.map(v => ({ id: v._id.toString(), name: v.nameSnapshot, partySize: v.partySize, seats: v.seats, status: v.status, source: v.source, startedAt: v.startedAt, endedAt: v.endedAt ?? null, durationMinutes: Math.max(0, Math.floor(((v.endedAt?.getTime() ?? Date.now()) - v.startedAt.getTime()) / 60000)), orderId: v.orderId?.toString(), amountPaid: v.amountPaid, paidAt: v.paidAt ?? null })), serverNow: new Date().toISOString() };
}
export async function updateCustomer(restaurantId: string, id: string, staffId: string, input: { serviceTag: string; serviceNotes: string }) {
  const contact = await Contact.findOneAndUpdate({ _id: id, restaurantId }, { $set: input }, { returnDocument: "after", runValidators: true });
  if (!contact) throw new AppError("Customer not found.", 404, "NOT_FOUND");
  await recordAuditLog({ restaurantId: new Types.ObjectId(restaurantId), staffId: new Types.ObjectId(staffId), action: "customer.service_profile_updated", entityType: "Contact", entityId: id, afterValue: input });
  return customerDetail(restaurantId, id);
}
