import { randomUUID } from "crypto";
import QRCode from "qrcode";
import { AppError } from "../utils/app-error";
import { Restaurant } from "../models/restaurant.model";
import { User, resolveVisibleModules, type UserDocument } from "../models/user.model";
import { comparePassword, comparePin, hashPassword } from "../utils/password";
import {
  buildTwoFactorUri,
  generateTwoFactorSecret,
  verifyTwoFactorCode,
} from "../utils/totp";
import {
  decodeTokenExpiry,
  signAccessToken,
  signRefreshToken,
  signTwoFactorToken,
  verifyRefreshToken,
  verifyTwoFactorToken,
} from "../utils/jwt";
import {
  getLockoutSecondsRemaining,
  isLockedOut,
  recordFailedAttempt,
  resetAttempts,
} from "../utils/login-attempt-tracker";
import {
  createSession,
  findSessionByRefreshToken,
  revokeAllSessionsForUser,
  revokeSession,
} from "./session.service";
import { recordAuditLog } from "./audit-log.service";

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface SanitizedUser {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  role: UserDocument["role"];
  visibleModules: ReturnType<typeof resolveVisibleModules>;
  isActive: boolean;
  mustResetPassword: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
  isDemo?: boolean;
  demoExpiresAt?: number;
}

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

const INCORRECT_CREDENTIALS_MESSAGE = "Incorrect email or password. Try again.";
const INCORRECT_PIN_MESSAGE = "Incorrect PIN. Try again.";
const DEACTIVATED_MESSAGE = "This account has been deactivated. Contact your admin.";

function sanitizeUser(user: UserDocument): SanitizedUser {
  const isDemo = Boolean(user.email?.toLowerCase().includes("demo") || user.name?.toLowerCase().includes("demo"));
  return {
    id: user._id.toString(),
    restaurantId: user.restaurantId.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    visibleModules: resolveVisibleModules(user.role, user.visibleModules),
    isActive: user.isActive,
    mustResetPassword: user.mustResetPassword,
    twoFactorEnabled: user.twoFactorEnabled,
    lastLoginAt: user.lastLoginAt ?? null,
    isDemo,
    demoExpiresAt: isDemo ? Date.now() + 3600 * 1000 : undefined,
  };
}

function lockoutError(secondsRemaining: number): AppError {
  return new AppError(
    `Too many incorrect attempts. Try again in ${secondsRemaining} seconds.`,
    429,
    "LOCKED_OUT",
  );
}

async function issueTokensForUser(
  user: UserDocument,
  meta: RequestMeta,
): Promise<SessionTokens> {
  const refreshToken = signRefreshToken({
    userId: user._id.toString(),
    jti: randomUUID(),
  });
  const expiresAt = decodeTokenExpiry(refreshToken);

  await createSession({
    userId: user._id,
    refreshToken,
    expiresAt,
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  const accessToken = signAccessToken({
    userId: user._id.toString(),
    restaurantId: user.restaurantId.toString(),
    role: user.role,
  });

  return { accessToken, refreshToken };
}

/**
 * Self-hosted deployments run exactly one restaurant per instance (PRD
 * "Deployment Model"), so the PIN-login terminal doesn't need to know a
 * restaurantId up front. If exactly one restaurant exists in this
 * instance's database, use it; otherwise the caller must supply
 * `restaurantId` explicitly (future multi-tenant/SaaS mode).
 */
async function resolveSingleRestaurantId(
  restaurantId?: string,
): Promise<string> {
  if (restaurantId) return restaurantId;

  const restaurants = await Restaurant.find().limit(2).select("_id");
  if (restaurants.length === 1) {
    return restaurants[0]._id.toString();
  }

  throw new AppError("restaurantId is required.", 400, "RESTAURANT_ID_REQUIRED");
}

interface LoginInput {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export type LoginResult =
  | { twoFactorRequired: true; twoFactorToken: string }
  | ({ twoFactorRequired: false; user: SanitizedUser } & SessionTokens);

export async function login(input: LoginInput): Promise<LoginResult> {
  const lockKey = `password:${input.email}`;
  if (isLockedOut(lockKey)) {
    throw lockoutError(getLockoutSecondsRemaining(lockKey));
  }

  const user = await User.findOne({ email: input.email }).select(
    "+passwordHash",
  );

  if (!user) {
    recordFailedAttempt(lockKey);
    throw new AppError(INCORRECT_CREDENTIALS_MESSAGE, 401, "INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new AppError(DEACTIVATED_MESSAGE, 403, "ACCOUNT_DEACTIVATED");
  }

  const passwordMatches = await comparePassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    recordFailedAttempt(lockKey);
    throw new AppError(INCORRECT_CREDENTIALS_MESSAGE, 401, "INVALID_CREDENTIALS");
  }

  resetAttempts(lockKey);

  if (user.twoFactorEnabled) {
    return {
      twoFactorRequired: true,
      twoFactorToken: signTwoFactorToken(user._id.toString()),
    };
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokensForUser(user, {
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
  });

  await recordAuditLog({
    restaurantId: user.restaurantId,
    staffId: user._id,
    action: "LOGIN_SUCCESS",
    entityType: "User",
    entityId: user._id.toString(),
  });

  return { twoFactorRequired: false, ...tokens, user: sanitizeUser(user) };
}

interface TwoFactorVerifyInput {
  twoFactorToken: string;
  code: string;
  userAgent?: string;
  ipAddress?: string;
}

export async function completeTwoFactorLogin(
  input: TwoFactorVerifyInput,
): Promise<{ user: SanitizedUser } & SessionTokens> {
  let userId: string;
  try {
    userId = verifyTwoFactorToken(input.twoFactorToken).userId;
  } catch {
    throw new AppError(
      "2FA session expired. Please log in again.",
      401,
      "INVALID_2FA_TOKEN",
    );
  }

  const user = await User.findById(userId).select("+twoFactorSecret");
  if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AppError(
      "Two-factor authentication is not available for this account.",
      400,
      "2FA_NOT_ENABLED",
    );
  }

  const lockKey = `2fa:${user._id.toString()}`;
  if (isLockedOut(lockKey)) {
    throw lockoutError(getLockoutSecondsRemaining(lockKey));
  }

  const isValid = await verifyTwoFactorCode(input.code, user.twoFactorSecret);
  if (!isValid) {
    recordFailedAttempt(lockKey);
    throw new AppError("Incorrect verification code. Try again.", 401, "INVALID_2FA_CODE");
  }
  resetAttempts(lockKey);

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokensForUser(user, {
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
  });

  await recordAuditLog({
    restaurantId: user.restaurantId,
    staffId: user._id,
    action: "LOGIN_SUCCESS_2FA",
    entityType: "User",
    entityId: user._id.toString(),
  });

  return { ...tokens, user: sanitizeUser(user) };
}

interface PinLoginInput {
  restaurantId?: string;
  staffId: string;
  pin: string;
  userAgent?: string;
  ipAddress?: string;
}

export async function pinLogin(
  input: PinLoginInput,
): Promise<{ user: SanitizedUser } & SessionTokens> {
  const restaurantId = await resolveSingleRestaurantId(input.restaurantId);
  const lockKey = `pin:${restaurantId}:${input.staffId}`;

  if (isLockedOut(lockKey)) {
    throw lockoutError(getLockoutSecondsRemaining(lockKey));
  }

  const user = await User.findOne({
    _id: input.staffId,
    restaurantId,
  }).select("+pinHash");

  if (!user || !user.pinHash) {
    recordFailedAttempt(lockKey);
    throw new AppError(INCORRECT_PIN_MESSAGE, 401, "INVALID_PIN");
  }

  if (!user.isActive) {
    throw new AppError(DEACTIVATED_MESSAGE, 403, "ACCOUNT_DEACTIVATED");
  }

  // Judgment call: PIN quick-login is for frontline terminal clock-in only
  // (docs/03-wireframes/login.html State B has no 2FA step). Accounts with
  // 2FA enabled (owner/manager per PRD §3.1) must use the full email +
  // password + 2FA flow, otherwise PIN login would be a way around
  // mandatory 2FA for admin-level accounts.
  if (user.twoFactorEnabled) {
    throw new AppError(
      "This account requires email, password, and 2FA login.",
      403,
      "PIN_LOGIN_NOT_ALLOWED",
    );
  }

  const pinMatches = await comparePin(input.pin, user.pinHash);
  if (!pinMatches) {
    recordFailedAttempt(lockKey);
    throw new AppError(INCORRECT_PIN_MESSAGE, 401, "INVALID_PIN");
  }
  resetAttempts(lockKey);

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokensForUser(user, {
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
  });

  await recordAuditLog({
    restaurantId: user.restaurantId,
    staffId: user._id,
    action: "PIN_LOGIN_SUCCESS",
    entityType: "User",
    entityId: user._id.toString(),
  });

  return { ...tokens, user: sanitizeUser(user) };
}

export interface PinPickerStaff {
  id: string;
  name: string;
  role: UserDocument["role"];
}

export async function getStaffForPinPicker(
  restaurantId?: string,
): Promise<{ restaurantId: string; staff: PinPickerStaff[] }> {
  const resolvedRestaurantId = await resolveSingleRestaurantId(restaurantId);

  const staff = await User.find({
    restaurantId: resolvedRestaurantId,
    isActive: true,
    pinHash: { $exists: true, $ne: null },
  })
    .select("name role")
    .sort({ name: 1 });

  return {
    restaurantId: resolvedRestaurantId,
    staff: staff.map((member) => ({
      id: member._id.toString(),
      name: member.name,
      role: member.role,
    })),
  };
}

interface RefreshInput {
  refreshToken?: string;
  userAgent?: string;
  ipAddress?: string;
}

export async function refreshSession(
  input: RefreshInput,
): Promise<{ user: SanitizedUser } & SessionTokens> {
  if (!input.refreshToken) {
    throw new AppError("Session expired. Please log in again.", 401, "UNAUTHENTICATED");
  }

  let payload: { userId: string };
  try {
    payload = verifyRefreshToken(input.refreshToken);
  } catch {
    throw new AppError("Session expired. Please log in again.", 401, "INVALID_REFRESH_TOKEN");
  }

  const session = await findSessionByRefreshToken(input.refreshToken);
  if (!session) {
    throw new AppError("Session not recognized. Please log in again.", 401, "INVALID_REFRESH_TOKEN");
  }

  if (session.revokedAt) {
    // Rotation-reuse detection with a 60-second grace window:
    // In React 18/19 StrictMode or concurrent duplicate calls,
    // multiple requests can present the same token almost simultaneously.
    const ROTATION_GRACE_PERIOD_MS = 60 * 1000;
    const isWithinGracePeriod =
      Date.now() - session.revokedAt.getTime() < ROTATION_GRACE_PERIOD_MS;

    if (!isWithinGracePeriod) {
      await revokeAllSessionsForUser(session.userId);
      throw new AppError(
        "Session revoked for security. Please log in again.",
        401,
        "REFRESH_TOKEN_REUSED",
      );
    }

    // Within grace period: user is legitimate! Fetch user and issue fresh tokens without killing other sessions.
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new AppError("Account not available.", 401, "ACCOUNT_UNAVAILABLE");
    }

    const tokens = await issueTokensForUser(user, {
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });

    return { ...tokens, user: sanitizeUser(user) };
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw new AppError("Session expired. Please log in again.", 401, "SESSION_EXPIRED");
  }

  const user = await User.findById(payload.userId);
  if (!user || !user.isActive) {
    throw new AppError("Account not available.", 401, "ACCOUNT_UNAVAILABLE");
  }

  await revokeSession(session._id);

  const tokens = await issueTokensForUser(user, {
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
  });

  return { ...tokens, user: sanitizeUser(user) };
}

export async function logout(input: { refreshToken?: string }): Promise<void> {
  if (!input.refreshToken) return;

  const session = await findSessionByRefreshToken(input.refreshToken);
  if (!session || session.revokedAt) return;

  await revokeSession(session._id);

  const user = await User.findById(session.userId).select("restaurantId");
  if (user) {
    await recordAuditLog({
      restaurantId: user.restaurantId,
      staffId: user._id,
      action: "LOGOUT",
      entityType: "Session",
      entityId: session._id.toString(),
    });
  }
}

export async function getCurrentUser(userId: string): Promise<SanitizedUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("Account not found.", 404, "NOT_FOUND");
  }
  return sanitizeUser(user);
}

export async function setupTwoFactor(
  userId: string,
): Promise<{ otpauthUrl: string; qrCodeDataUrl: string }> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("Account not found.", 404, "NOT_FOUND");
  }

  const secret = generateTwoFactorSecret();
  user.twoFactorSecret = secret;
  await user.save();

  const otpauthUrl = buildTwoFactorUri(user.email, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return { otpauthUrl, qrCodeDataUrl };
}

export async function enableTwoFactor(userId: string, code: string): Promise<void> {
  const user = await User.findById(userId).select("+twoFactorSecret");
  if (!user || !user.twoFactorSecret) {
    throw new AppError("Start 2FA setup before enabling it.", 400, "2FA_NOT_SET_UP");
  }

  const isValid = await verifyTwoFactorCode(code, user.twoFactorSecret);
  if (!isValid) {
    throw new AppError("Incorrect verification code. Try again.", 401, "INVALID_2FA_CODE");
  }

  user.twoFactorEnabled = true;
  await user.save();

  await recordAuditLog({
    restaurantId: user.restaurantId,
    staffId: user._id,
    action: "TWO_FACTOR_ENABLED",
    entityType: "User",
    entityId: user._id.toString(),
  });
}

export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("Account not found.", 404, "NOT_FOUND");
  }

  user.passwordHash = await hashPassword(newPassword);
  user.mustResetPassword = false;
  await user.save();

  await recordAuditLog({
    restaurantId: user.restaurantId,
    staffId: user._id,
    action: "PASSWORD_RESET_COMPLETED",
    entityType: "User",
    entityId: user._id.toString(),
  });
}

export async function createDemoSession(
  email?: string,
  name?: string,
  meta: RequestMeta = {},
): Promise<{ accessToken: string; refreshToken: string; user: SanitizedUser }> {
  let restaurant = await Restaurant.findOne();
  if (!restaurant) {
    restaurant = await Restaurant.create({
      name: "QRWIK Demo Bistro",
      slug: "qrwik-demo-bistro",
      address: {
        line1: "100 Grand Avenue",
        city: "San Francisco",
        state: "CA",
        postalCode: "94105",
        country: "USA",
      },
      taxConfig: [
        { name: "CGST", ratePercent: 2.5, type: "CGST" },
        { name: "SGST", ratePercent: 2.5, type: "SGST" },
      ],
      settings: {
        discountApprovalThreshold: { type: "percent", value: 10 },
        enabledPaymentModes: ["cash", "card", "upi"],
      },
    });
  }

  const demoEmail = email && email.trim().length > 0 ? email.toLowerCase().trim() : "demo@qrwikpos.com";
  const demoName = name?.trim() || "Live Demo Manager";

  let user = await User.findOne({ email: demoEmail });
  if (!user) {
    const passwordHash = await hashPassword("DemoPass123!");
    user = await User.create({
      restaurantId: restaurant._id,
      name: demoName,
      email: demoEmail,
      passwordHash,
      role: "owner",
      isActive: true,
      mustResetPassword: false,
      twoFactorEnabled: false,
    });
  } else {
    user.isActive = true;
    user.role = "owner";
    await user.save();
  }

  const oneHourInSeconds = 3600;
  const demoExpiresAt = Date.now() + oneHourInSeconds * 1000;

  const tokens = await issueTokensForUser(user, meta);

  const sanitized = sanitizeUser(user);
  sanitized.isDemo = true;
  sanitized.demoExpiresAt = demoExpiresAt;

  return { ...tokens, user: sanitized };
}
