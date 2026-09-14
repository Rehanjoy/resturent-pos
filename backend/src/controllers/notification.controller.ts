import { asyncHandler } from "../utils/async-handler";
import { getSession, resolveQr } from "../services/dining.service";
import * as notifications from "../services/notification.service";

export const listStaff = asyncHandler(async (req, res) => {
  res.json(await notifications.listStaffNotifications(req.user!.restaurantId, req.user!.userId, req.user!.role, req.query as never));
});
export const unreadCounts = asyncHandler(async (req, res) => {
  res.json(await notifications.staffUnreadCounts(req.user!.restaurantId, req.user!.userId, req.user!.role));
});
export const markStaffRead = asyncHandler(async (req, res) => {
  res.json(await notifications.markStaffNotificationRead(req.user!.restaurantId, req.user!.userId, req.user!.role, String(req.params.id)));
});
export const markAllStaffRead = asyncHandler(async (req, res) => {
  res.json(await notifications.markAllStaffNotificationsRead(req.user!.restaurantId, req.user!.userId, req.user!.role));
});

async function guestAudience(qrToken: string, token: string) {
  const { restaurantId } = await resolveQr(qrToken);
  const { session } = await getSession(restaurantId, token);
  return { restaurantId, sessionId: session.id };
}
export const listGuest = asyncHandler(async (req, res) => {
  const audience = await guestAudience(String(req.params.qrToken), req.get("X-Dining-Token")!);
  res.json(await notifications.listGuestNotifications(audience.restaurantId, audience.sessionId, req.query as never));
});
export const markGuestRead = asyncHandler(async (req, res) => {
  const audience = await guestAudience(String(req.params.qrToken), req.get("X-Dining-Token")!);
  res.json(await notifications.markGuestNotificationRead(audience.restaurantId, audience.sessionId, String(req.params.id)));
});
