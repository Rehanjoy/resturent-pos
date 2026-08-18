"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { MANAGER_ASSIGNABLE_ROLES, STAFF_ROLES, type StaffMember, type StaffRole } from "@/lib/staff/types";

export interface StaffFormValues {
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
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
  const [password, setPassword] = useState("");

  return (
    <Modal title={isEdit ? "Edit Staff Member" : "Add Staff Member"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim(), role, password });
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
            className="rounded-md border border-border px-3 py-2 text-body text-text"
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
            className="rounded-md border border-border px-3 py-2 text-body text-text disabled:bg-background disabled:text-text-muted"
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
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as StaffRole)}
            className="rounded-md border border-border px-3 py-2 text-body text-text"
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

        {!isEdit && (
          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Initial password (optional)</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Leave blank to auto-generate one"
              className="rounded-md border border-border px-3 py-2 text-body text-text"
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
            className="rounded-md border border-border px-4 py-2 text-button text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !email.trim()}
            className="rounded-md bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
