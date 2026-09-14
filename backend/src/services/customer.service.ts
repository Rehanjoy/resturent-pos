import { Types } from "mongoose";
import { Contact } from "../models/contact.model";
import { CustomerVisit } from "../models/customer-visit.model";
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
  const endedAt = session.status === "expired" ? session.expiresAt : session.releasedAt;
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
export async function recordVisitPayment(restaurantId: string, orderId: string, invoiceId: string) {
  const payments = await Payment.find({ restaurantId, invoiceId }).lean();
  await CustomerVisit.updateOne({ restaurantId, orderId }, { $set: {
    amountPaid: payments.reduce((total, payment) => total + payment.amount, 0),
    paidAt: payments.length ? payments[payments.length - 1]!.createdAt : undefined,
  } });
}
async function expireVisits(restaurantId: string) {
  await CustomerVisit.updateMany({ restaurantId, status: "held", expiresAt: { $lte: new Date(), $ne: null } }, [
    { $set: { status: "expired", endedAt: "$expiresAt" } },
  ], { updatePipeline: true });
}
export async function listCustomers(restaurantId: string, search = "", page = 1) {
  await expireVisits(restaurantId);
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = { restaurantId, ...(search ? { $or: [{ name: { $regex: escaped, $options: "i" } }, { phone: { $regex: escaped } }] } : {}) };
  const [contacts, total] = await Promise.all([Contact.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * 30).limit(30).lean(), Contact.countDocuments(filter)]);
  const summaries = await CustomerVisit.aggregate([{ $match: { restaurantId: new Types.ObjectId(restaurantId), contactId: { $in: contacts.map(c => c._id) } } }, { $group: { _id: "$contactId", visitCount: { $sum: 1 }, amountPaid: { $sum: "$amountPaid" }, lastVisitAt: { $max: "$startedAt" } } }]);
  return { customers: contacts.map(c => {
    const summary = summaries.find(s => s._id.equals(c._id));
    return { id: c._id.toString(), name: c.name, phone: c.phone, serviceTag: c.serviceTag ?? "normal", serviceNotes: c.serviceNotes ?? "", visitCount: summary?.visitCount ?? 0, amountPaid: summary?.amountPaid ?? 0, lastVisitAt: summary?.lastVisitAt ?? null };
  }), total, page, totalPages: Math.max(1, Math.ceil(total / 30)) };
}
export async function customerDetail(restaurantId: string, id: string) {
  await expireVisits(restaurantId);
  const contact = await Contact.findOne({ _id: id, restaurantId }).lean();
  if (!contact) throw new AppError("Customer not found.", 404, "NOT_FOUND");
  const visits = await CustomerVisit.find({ restaurantId, contactId: id }).sort({ startedAt: -1 }).limit(100).lean();
  return { customer: { id, name: contact.name, phone: contact.phone, serviceTag: contact.serviceTag ?? "normal", serviceNotes: contact.serviceNotes ?? "" },
    visits: visits.map(v => ({ id: v._id.toString(), name: v.nameSnapshot, partySize: v.partySize, seats: v.seats, status: v.status, source: v.source, startedAt: v.startedAt, endedAt: v.endedAt ?? null, durationMinutes: Math.max(0, Math.floor(((v.endedAt?.getTime() ?? Date.now()) - v.startedAt.getTime()) / 60000)), orderId: v.orderId?.toString(), amountPaid: v.amountPaid, paidAt: v.paidAt ?? null })), serverNow: new Date().toISOString() };
}
export async function updateCustomer(restaurantId: string, id: string, staffId: string, input: { serviceTag: string; serviceNotes: string }) {
  const contact = await Contact.findOneAndUpdate({ _id: id, restaurantId }, { $set: input }, { returnDocument: "after", runValidators: true });
  if (!contact) throw new AppError("Customer not found.", 404, "NOT_FOUND");
  await recordAuditLog({ restaurantId: new Types.ObjectId(restaurantId), staffId: new Types.ObjectId(staffId), action: "customer.service_profile_updated", entityType: "Contact", entityId: id, afterValue: input });
  return customerDetail(restaurantId, id);
}
