import { randomBytes } from "crypto";
import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { User, type UserDocument, type UserRole } from "../models/user.model";
import { AuditLog } from "../models/audit-log.model";
import { Session } from "../models/session.model";
import { hashPassword } from "../utils/password";
import { recordAuditLog } from "./audit-log.service";
import { revokeAllSessionsForUser, revokeSession as revokeSessionById } from "./session.service";

/**
 * Roles a Manager may create/edit (PRD §2 RBAC matrix gives Manager
 * "View/Add" on Staff; this build's judgment call — documented in the
 * handover report — extends that to full edit/deactivate/reactivate, but
 * draws the line at Owner/Manager-role accounts themselves: a Manager can
 * fully administer frontline staff (Cashier/Server/Chef/Inventory Manager)
 * but can never create, edit, deactivate, or promote/demote an Owner or
 * another Manager. Only an Owner can touch Owner/Manager accounts. This
 * keeps a Manager from ever being able to escalate their own or a peer's
 * privileges, or lock out the restaurant's Owner.
 */
const MANAGER_ASSIGNABLE_ROLES: UserRole[] = ["cashier", "server", "chef", "inventory_manager"];

export interface StaffDto {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  mustResetPassword: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffSessionDto {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  isActive: boolean;
}

export interface StaffActivityLogEntryDto {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  createdAt: Date;
}

function toStaffDto(user: HydratedDocument<UserDocument>): StaffDto {
  return {
    id: user._id.toString(),
    restaurantId: user.restaurantId.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    mustResetPassword: user.mustResetPassword,
    twoFactorEnabled: user.twoFactorEnabled,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Throws unless `actorRole` is allowed to assign/hold `targetRole`. Owner: unrestricted. */
function assertCanAssignRole(actorRole: UserRole, targetRole: UserRole): void {
  if (actorRole === "owner") return;
  if (actorRole === "manager" && MANAGER_ASSIGNABLE_ROLES.includes(targetRole)) return;
  throw new AppError(
    "Only an Owner can create or manage Owner or Manager accounts.",
    403,
    "STAFF_ROLE_NOT_PERMITTED",
  );
}

/**
 * Same boundary as `assertCanAssignRole`, applied to an *existing* staff
 * record's current role — used before any edit/deactivate/reactivate/
 * session-management action so a Manager can never touch an Owner or
 * another Manager's account, even to just change their phone number.
 */
function assertCanManageExistingStaff(actorRole: UserRole, existingRole: UserRole): void {
  assertCanAssignRole(actorRole, existingRole);
}

/** 12-character alphanumeric temporary password, e.g. "aK9mQz3RtP2v". */
function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let password = "";
  for (let i = 0; i < bytes.length; i += 1) {
    password += alphabet[bytes[i] % alphabet.length];
  }
  return password;
}

async function assertEmailAvailable(
  restaurantId: string,
  email: string,
  excludeId?: string,
): Promise<void> {
  const existing = await User.findOne({
    restaurantId,
    email,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (existing) {
    throw new AppError(
      "A staff account with this email already exists.",
      409,
      "DUPLICATE_STAFF_EMAIL",
    );
  }
}

export async function findStaffOrThrow(
  restaurantId: string,
  staffId: string,
): Promise<HydratedDocument<UserDocument>> {
  if (!Types.ObjectId.isValid(staffId)) {
    throw new AppError("Staff member not found.", 404, "NOT_FOUND");
  }
  const user = await User.findOne({ _id: staffId, restaurantId });
  if (!user) {
    throw new AppError("Staff member not found.", 404, "NOT_FOUND");
  }
  return user;
}

export async function listStaff(restaurantId: string): Promise<StaffDto[]> {
  const staff = await User.find({ restaurantId }).sort({ name: 1 });
  return staff.map(toStaffDto);
}

export async function getStaffDetail(restaurantId: string, staffId: string): Promise<StaffDto> {
  const user = await findStaffOrThrow(restaurantId, staffId);
  return toStaffDto(user);
}

export interface CreateStaffInput {
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  password?: string;
}

export interface CreateStaffResult {
  staff: StaffDto;
  /** Only present when no password was supplied — the admin UI must show
   * this once so it can be handed to the new staff member out of band (no
   * email/SMS provider is wired up yet, see docs/env-registry.md and the
   * Settings module's notification-preferences scope note). Never logged,
   * never persisted in plaintext, never returned again after this call. */
  temporaryPassword?: string;
}

/**
 * Creates a staff account (PRD §3.11). `mustResetPassword` is always set to
 * `true` for admin-created accounts (PRD §3.1 "Forced password reset on
 * first login for staff accounts created by Admin") regardless of whether
 * an initial password was supplied or auto-generated.
 */
export async function createStaff(
  restaurantId: string,
  actorRole: UserRole,
  input: CreateStaffInput,
): Promise<CreateStaffResult> {
  assertCanAssignRole(actorRole, input.role);
  await assertEmailAvailable(restaurantId, input.email);

  const generatedPassword = input.password ? undefined : generateTemporaryPassword();
  const passwordToHash = input.password ?? generatedPassword!;

  const user = await User.create({
    restaurantId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: input.role,
    passwordHash: await hashPassword(passwordToHash),
    mustResetPassword: true,
    isActive: true,
  });

  await recordAuditLog({
    restaurantId: new Types.ObjectId(restaurantId),
    staffId: user._id,
    action: "staff.created",
    entityType: "User",
    entityId: user._id.toString(),
    afterValue: { name: user.name, email: user.email, role: user.role },
  });

  return { staff: toStaffDto(user), temporaryPassword: generatedPassword };
}

export interface UpdateStaffInput {
  name?: string;
  phone?: string;
  role?: UserRole;
}

export async function updateStaff(
  restaurantId: string,
  actorRole: UserRole,
  staffId: string,
  input: UpdateStaffInput,
): Promise<StaffDto> {
  const user = await findStaffOrThrow(restaurantId, staffId);
  assertCanManageExistingStaff(actorRole, user.role);
  if (input.role !== undefined) {
    assertCanAssignRole(actorRole, input.role);
  }

  const beforeValue = { name: user.name, phone: user.phone, role: user.role };

  if (input.name !== undefined) user.name = input.name;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.role !== undefined) user.role = input.role;

  await user.save();

  await recordAuditLog({
    restaurantId: new Types.ObjectId(restaurantId),
    staffId: user._id,
    action: "staff.updated",
    entityType: "User",
    entityId: user._id.toString(),
    beforeValue,
    afterValue: { name: user.name, phone: user.phone, role: user.role },
  });

  return toStaffDto(user);
}

/**
 * Soft delete only — a staff record is referenced by orders, invoices, and
 * audit logs, so it is never hard-deleted (PRD §7 auditability would break
 * if a staff name/id vanished from historical records). Deactivating also
 * immediately revokes every active session so a deactivated account can't
 * keep using an already-issued access/refresh token.
 */
export async function setStaffActiveStatus(
  restaurantId: string,
  actorRole: UserRole,
  actorId: string,
  staffId: string,
  isActive: boolean,
): Promise<StaffDto> {
  const user = await findStaffOrThrow(restaurantId, staffId);
  assertCanManageExistingStaff(actorRole, user.role);

  if (!isActive && staffId === actorId) {
    throw new AppError("You cannot deactivate your own account.", 400, "CANNOT_DEACTIVATE_SELF");
  }

  if (user.isActive === isActive) {
    return toStaffDto(user);
  }

  user.isActive = isActive;
  await user.save();

  if (!isActive) {
    await revokeAllSessionsForUser(user._id);
  }

  await recordAuditLog({
    restaurantId: new Types.ObjectId(restaurantId),
    staffId: new Types.ObjectId(actorId),
    action: isActive ? "staff.reactivated" : "staff.deactivated",
    entityType: "User",
    entityId: user._id.toString(),
    beforeValue: { isActive: !isActive },
    afterValue: { isActive },
  });

  return toStaffDto(user);
}

/**
 * Paginated read path over the existing append-only `AuditLog` collection
 * (PRD §3.11 "Activity audit log per staff (logins, orders created,
 * discounts applied, voids)"). Surfaces whatever action strings the other
 * modules already record (`LOGIN_SUCCESS`, `order.void`,
 * `invoice.discount_applied`, `invoice.void`, `staff.created`, ...) —
 * deliberately not a parallel logging system.
 */
export async function getStaffActivityLog(
  restaurantId: string,
  staffId: string,
  page: number,
  limit: number,
): Promise<{ logs: StaffActivityLogEntryDto[]; page: number; limit: number; total: number }> {
  await findStaffOrThrow(restaurantId, staffId);

  const query = { restaurantId, staffId };
  const [entries, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(query),
  ]);

  return {
    logs: entries.map((entry) => ({
      id: entry._id.toString(),
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      beforeValue: entry.beforeValue,
      afterValue: entry.afterValue,
      createdAt: entry.createdAt,
    })),
    page,
    limit,
    total,
  };
}

function toSessionDto(session: {
  _id: Types.ObjectId;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date | null;
}): StaffSessionDto {
  const isActive = !session.revokedAt && session.expiresAt.getTime() > Date.now();
  return {
    id: session._id.toString(),
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt ?? null,
    isActive,
  };
}

/** PRD §3.1 "Admin can view & revoke active sessions per staff." */
export async function listStaffSessions(
  restaurantId: string,
  actorRole: UserRole,
  staffId: string,
): Promise<StaffSessionDto[]> {
  const user = await findStaffOrThrow(restaurantId, staffId);
  assertCanManageExistingStaff(actorRole, user.role);

  const sessions = await Session.find({ userId: user._id }).sort({ createdAt: -1 });
  return sessions.map(toSessionDto);
}

export async function revokeStaffSession(
  restaurantId: string,
  actorRole: UserRole,
  actorId: string,
  staffId: string,
  sessionId: string,
): Promise<void> {
  const user = await findStaffOrThrow(restaurantId, staffId);
  assertCanManageExistingStaff(actorRole, user.role);

  if (!Types.ObjectId.isValid(sessionId)) {
    throw new AppError("Session not found.", 404, "NOT_FOUND");
  }
  const session = await Session.findOne({ _id: sessionId, userId: user._id });
  if (!session) {
    throw new AppError("Session not found.", 404, "NOT_FOUND");
  }

  // Revoking (never deleting) matches the model's "part of the audit
  // trail" convention — see session.model.ts.
  await revokeSessionById(session._id);

  await recordAuditLog({
    restaurantId: new Types.ObjectId(restaurantId),
    staffId: new Types.ObjectId(actorId),
    action: "staff.session_revoked",
    entityType: "Session",
    entityId: session._id.toString(),
    beforeValue: { staffId: user._id.toString() },
  });
}
