import { ServiceRequest, type ServiceRequestDocument, type ServiceRequestType } from "../models/service-request.model";
import { DiningFloor, type SeatSelection } from "../models/dining-floor.model";
import { Table } from "../models/table.model";
import { getSession, resolveQr } from "./dining.service";
import { AppError } from "../utils/app-error";
import { emitToRestaurant } from "../sockets";
import { notifyServiceRequest } from "./notification.service";

function toDto(record: ServiceRequestDocument, session?: { assignedWaiter?: { id: string; name: string } | null; customer?: { name: string; phone: string }; bookingMode?: string }) {
  return { id: record._id.toString(), sessionId: record.sessionId, type: record.type, note: record.note,
    status: record.status, seats: record.seats, createdAt: record.createdAt.toISOString(),
    assignedWaiter: session?.assignedWaiter ?? null, customer: session?.customer ? { name: session.customer.name, phone: session.customer.phone } : null,
    bookingMode: session?.bookingMode ?? "chairs",
    acknowledgedAt: record.acknowledgedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null };
}
function notify(restaurantId: string) { emitToRestaurant(restaurantId, "service:updated", {}); }

/** Floor release/hold expiry invalidates unfinished calls. Filtering uses the
 * current floor state so a reassigned chair never inherits an old guest call. */
async function expireStaleRequests(restaurantId: string) {
  const floor = await DiningFloor.findOne({ restaurantId }).lean();
  const now = Date.now();
  const activeIds = (floor?.sessions ?? []).filter(session => session.status === "occupied" ||
    (session.status === "held" && (session.expiresAt === null || Date.parse(session.expiresAt) > now))).map(session => session.id);
  const result = await ServiceRequest.updateMany({ restaurantId, isOpen: true, sessionId: { $nin: activeIds } },
    { $set: { status: "expired", isOpen: false } });
  if (result.modifiedCount) notify(restaurantId);
}
async function guestSession(qrToken: string, token: string) {
  const { restaurantId } = await resolveQr(qrToken);
  const { session } = await getSession(restaurantId, token);
  return { restaurantId, session };
}
function requireActive(status: string) {
  if (status !== "held" && status !== "occupied") throw new AppError("Your seating has ended. Reserve a chair or ask staff for help.", 409, "DINING_SESSION_ENDED");
}
export async function createGuestServiceRequest(qrToken: string, token: string, input: { type: ServiceRequestType; seat?: SeatSelection; note?: string }) {
  const { restaurantId, session } = await guestSession(qrToken, token);
  requireActive(session.status);
  if (input.seat && !session.seats.some(seat => seat.tableId === input.seat!.tableId && seat.chairNumber === input.seat!.chairNumber)) {
    throw new AppError("Choose a chair from your own booking.", 400, "INVALID_SERVICE_SEAT");
  }
  const selectedSeats = input.seat ? [input.seat] : session.seats;
  const tables = await Table.find({ restaurantId, _id: { $in: selectedSeats.map(seat => seat.tableId) } }).lean();
  const seats = selectedSeats.map(seat => ({ ...seat, tableName: tables.find(table => table._id.toString() === seat.tableId)?.name ?? "Table" }));
  let record;
  try {
    record = await ServiceRequest.findOneAndUpdate({ restaurantId, sessionId: session.id, type: input.type, isOpen: true },
      { $setOnInsert: { restaurantId, sessionId: session.id, type: input.type, note: input.note ?? "", seats, status: "pending", isOpen: true } },
      { upsert: true, new: true, runValidators: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    record = await ServiceRequest.findOne({ restaurantId, sessionId: session.id, type: input.type, isOpen: true });
    if (!record) throw new AppError("The service request just changed. Try again.", 409, "SERVICE_REQUEST_CHANGED");
  }
  // A release could occur between authentication and insertion. Recheck before
  // confirming the ticket; list/update also repair stale calls after a crash.
  await expireStaleRequests(restaurantId);
  const current = await ServiceRequest.findOne({ _id: record!._id, restaurantId });
  if (!current || current.status === "expired") throw new AppError("Your seating has ended. Please ask staff for help.", 409, "DINING_SESSION_ENDED");
  notify(restaurantId);
  notifyServiceRequest({ restaurantId, requestId: current.id, sessionId: current.sessionId, type: current.type, status: "pending", assignedWaiterId: session.assignedWaiter?.id, tableLabel: current.seats[0]?.tableName ?? "Table", seats: current.seats });
  return toDto(current, session);
}
export async function listGuestServiceRequests(qrToken: string, token: string) {
  const { restaurantId, session } = await guestSession(qrToken, token);
  await expireStaleRequests(restaurantId);
  return (await ServiceRequest.find({ restaurantId, sessionId: session.id }).sort({ createdAt: -1 }).limit(30)).map((record) => toDto(record, session));
}
export async function listStaffServiceRequests(restaurantId: string) {
  await expireStaleRequests(restaurantId);
  const [records, floor] = await Promise.all([
    ServiceRequest.find({ restaurantId, isOpen: true }).sort({ createdAt: 1 }),
    DiningFloor.findOne({ restaurantId }).lean(),
  ]);
  return records.map((record) => toDto(record, floor?.sessions.find((session) => session.id === record.sessionId)));
}
export async function updateServiceRequest(restaurantId: string, requestId: string, staffId: string, status: "acknowledged" | "completed") {
  await expireStaleRequests(restaurantId);
  const now = new Date();
  const update = status === "acknowledged"
    ? { status, acknowledgedAt: now, acknowledgedBy: staffId }
    : { status, completedAt: now, completedBy: staffId, isOpen: false };
  const current = await ServiceRequest.findOne({ _id: requestId, restaurantId });
  if (!current) throw new AppError("Service request not found.", 404, "NOT_FOUND");
  if (current.status === "expired") throw new AppError("This guest's seating has ended.", 409, "DINING_SESSION_ENDED");
  const allowed = status === "acknowledged" ? current.status === "pending" : current.status === "pending" || current.status === "acknowledged";
  if (allowed) {
    Object.assign(current, update);
    await current.save();
    notify(restaurantId);
  }
  // Repeated acknowledgements/completions never overwrite the first staff/time.
  const floor = await DiningFloor.findOne({ restaurantId }).lean();
  const session = floor?.sessions.find((candidate) => candidate.id === current.sessionId);
  if (allowed) notifyServiceRequest({ restaurantId, requestId: current.id, sessionId: current.sessionId, type: current.type, status, assignedWaiterId: session?.assignedWaiter?.id, tableLabel: current.seats[0]?.tableName ?? "Table", seats: current.seats });
  return toDto(current, session);
}
