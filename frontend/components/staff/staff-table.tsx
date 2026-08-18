"use client";

import { EditIcon, PowerIcon } from "@/components/icons";
import { MANAGER_ASSIGNABLE_ROLES, STAFF_ROLES, type StaffMember, type StaffRole } from "@/lib/staff/types";

function roleLabel(role: StaffRole): string {
  return STAFF_ROLES.find((option) => option.value === role)?.label ?? role;
}

function formatLastLogin(value: string | null): string {
  if (!value) return "Never logged in";
  return `Last login ${new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/**
 * Reference screenshot's simple list layout — avatar initials circle, name
 * + email, role badge, edit/deactivate icon buttons — replacing the
 * previous plain `<table>`. Same rows, same data, same actions as before,
 * just a row-list instead of table markup: every action (view detail,
 * edit, deactivate/reactivate) and the exact same Owner-vs-Manager
 * `canManage` boundary from `staff.service.ts` (a Manager can administer
 * frontline staff but never edit/deactivate an Owner or another Manager's
 * account) carries over 1:1. There's no "delete" action in this app — staff
 * accounts are deactivated, never removed, so audit history/activity logs
 * stay intact — so the reference's "delete" icon button is a
 * deactivate/reactivate toggle here instead of inventing a destructive
 * delete this app doesn't support.
 */
export function StaffTable({
  staff,
  actorRole,
  actorId,
  onView,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  staff: StaffMember[];
  actorRole: StaffRole;
  actorId: string;
  onView: (member: StaffMember) => void;
  onEdit: (member: StaffMember) => void;
  onDeactivate: (member: StaffMember) => void;
  onReactivate: (member: StaffMember) => void;
}) {
  // Mirrors the server-side boundary in staff.service.ts: a Manager can
  // fully administer frontline staff but never edit/deactivate an Owner or
  // another Manager's account — those actions are hidden here rather than
  // shown-then-rejected.
  function canManage(member: StaffMember): boolean {
    if (actorRole === "owner") return true;
    return MANAGER_ASSIGNABLE_ROLES.includes(member.role);
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface shadow-sm">
      {staff.map((member) => (
        <li key={member.id} className="flex items-center gap-4 px-4 py-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-body font-semibold text-primary">
            {initialsOf(member.name)}
          </span>

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onView(member)}
              className="truncate text-body font-medium text-text hover:text-primary hover:underline"
            >
              {member.name}
            </button>
            {member.id === actorId && (
              <span className="ml-2 text-small text-text-muted">(you)</span>
            )}
            <p className="truncate text-small text-text-muted">{member.email}</p>
          </div>

          <span className="hidden shrink-0 rounded-full border border-border px-2.5 py-1 text-small font-medium capitalize text-text-muted sm:inline-block">
            {roleLabel(member.role)}
          </span>

          <span
            className={`hidden shrink-0 rounded-full px-2.5 py-1 text-small font-medium md:inline-block ${
              member.isActive ? "bg-success/10 text-success" : "bg-error/10 text-error"
            }`}
          >
            {member.isActive ? "Active" : "Deactivated"}
          </span>

          <p className="hidden w-44 shrink-0 text-small text-text-muted lg:block">
            {formatLastLogin(member.lastLoginAt)}
          </p>

          <div className="flex shrink-0 items-center gap-1.5">
            {canManage(member) && (
              <button
                type="button"
                onClick={() => onEdit(member)}
                title={`Edit ${member.name}`}
                aria-label={`Edit ${member.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-secondary/10 hover:text-secondary"
              >
                <EditIcon className="h-4 w-4" />
              </button>
            )}
            {canManage(member) && member.id !== actorId && (
              <button
                type="button"
                onClick={() => (member.isActive ? onDeactivate(member) : onReactivate(member))}
                title={member.isActive ? `Deactivate ${member.name}` : `Reactivate ${member.name}`}
                aria-label={member.isActive ? `Deactivate ${member.name}` : `Reactivate ${member.name}`}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  member.isActive
                    ? "text-text-muted hover:bg-error/10 hover:text-error"
                    : "text-text-muted hover:bg-success/10 hover:text-success"
                }`}
              >
                <PowerIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
