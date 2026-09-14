"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  MANAGER_ASSIGNABLE_ROLES,
  STAFF_MODULE_OPTIONS,
  STAFF_ROLES,
  defaultModulesForRole,
  type StaffMember,
  type StaffModule,
  type StaffRole,
} from "@/lib/staff/types";

export interface StaffFormValues {
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  visibleModules: StaffModule[];
  password: string;
}

export function StaffFormModal({
  staff,
  actorRole,
  onClose,
  onSubmit,
  isSubmitting,
  errorMessage,
}: {
  staff: StaffMember | null;
  actorRole: StaffRole;
  onClose: () => void;
  onSubmit: (values: StaffFormValues) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const isEdit = !!staff;
  const assignableRoles =
    actorRole === "owner" ? STAFF_ROLES : STAFF_ROLES.filter((r) => MANAGER_ASSIGNABLE_ROLES.includes(r.value));

  const [name, setName] = useState(staff?.name ?? "");
  const [email, setEmail] = useState(staff?.email ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [role, setRole] = useState<StaffRole>(staff?.role ?? assignableRoles[0]?.value ?? "cashier");
  const [visibleModules, setVisibleModules] = useState<StaffModule[]>(
    staff?.visibleModules?.length ? staff.visibleModules : defaultModulesForRole(staff?.role ?? assignableRoles[0]?.value ?? "cashier"),
  );
  const [password, setPassword] = useState("");

  return (
    <Modal title={isEdit ? "Edit Staff Member" : "Add Staff Member"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim(), role, visibleModules, password });
        }}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="e.g. Rohan Mehta"
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isEdit}
            placeholder="name@restaurant.com"
            className="rounded-lg border border-border px-3 py-2 text-body text-text disabled:bg-background disabled:text-text-muted"
          />
          {isEdit && (
            <span className="text-small text-text-muted">Email can&apos;t be changed here.</span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="e.g. 98765 43210"
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Role</span>
          <select
            value={role}
            onChange={(event) => {
              const nextRole = event.target.value as StaffRole;
              setRole(nextRole);
              setVisibleModules(defaultModulesForRole(nextRole));
            }}
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          >
            {assignableRoles.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {actorRole === "manager" && (
            <span className="text-small text-text-muted">
              Managers can only assign Cashier, Server, Chef, or Inventory Manager roles.
            </span>
          )}
        </label>

        <fieldset className="rounded-2xl border border-border bg-background/60 p-4">
          <legend className="px-1 text-small font-semibold text-text">Visible workspaces</legend>
          <p className="mb-3 text-small text-text-muted">
            Choose what appears in this staff member&apos;s navigation. Their role still controls which actions they can perform.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {STAFF_MODULE_OPTIONS.filter((module) => defaultModulesForRole(role).includes(module.value)).map((module) => {
              const checked = visibleModules.includes(module.value);
              return (
                <label
                  key={module.value}
                  className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                    checked ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-primary/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setVisibleModules((current) =>
                      checked ? current.filter((value) => value !== module.value) : [...current, module.value]
                    )}
                    className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <span>
                    <span className="block text-small font-semibold text-text">{module.label}</span>
                    <span className="block text-xs text-text-muted">{module.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {visibleModules.length === 0 && (
            <p role="alert" className="mt-3 text-small font-medium text-error">Select at least one workspace.</p>
          )}
        </fieldset>

        {!isEdit && (
          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Initial password (optional)</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Leave blank to auto-generate one"
              className="rounded-lg border border-border px-3 py-2 text-body text-text"
            />
            <span className="text-small text-text-muted">
              The new account is always required to reset its password on first login. Leave this
              blank and Saffron will generate a temporary password to hand to them.
            </span>
          </label>
        )}

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-button text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !email.trim() || visibleModules.length === 0}
            className="rounded-lg bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
