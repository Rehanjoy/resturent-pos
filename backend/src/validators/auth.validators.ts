import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

/**
 * PIN quick-login is scoped to a specific staff member selected from the
 * terminal's picker (see `docs/03-wireframes/login.html` State B), not a
 * free-text lookup — `staffId` comes from the picker tile the user tapped.
 * `restaurantId` is optional: self-hosted deployments only ever run one
 * restaurant (see `auth.service.ts` `resolveSingleRestaurantId`), so the
 * terminal doesn't have to know it up front.
 */
export const pinLoginSchema = z.object({
  restaurantId: z.string().min(1).optional(),
  staffId: z.string().min(1, "Select a staff member."),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits."),
});

export const pinLoginStaffQuerySchema = z.object({
  restaurantId: z.string().min(1).optional(),
});

export const twoFactorVerifySchema = z.object({
  twoFactorToken: z.string().min(1, "twoFactorToken is required."),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export const twoFactorEnableSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Za-z]/, "Password must include a letter.")
    .regex(/[0-9]/, "Password must include a number."),
});
