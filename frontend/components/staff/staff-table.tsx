"use client";

import { MANAGER_ASSIGNABLE_ROLES, STAFF_ROLES, type StaffMember, type StaffRole } from "@/lib/staff/types";

function roleLabel(role: StaffRole): string {
  return STAFF_ROLES.find((option) => option.value === role)?.label ?? role;
}

function formatLastLogin(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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
    <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
      <table className="w-full text-left text-body">
        <thead>
          <tr className="border-b border-border text-small font-medium text-text-muted">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Last login</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr key={member.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onView(member)}
                  className="font-medium text-text hover:text-primary hover:underline"
                >
                  {member.name}
                </button>
                {member.id === actorId && (
                  <span className="ml-2 text-small text-text-muted">(you)</span>
                )}
              </td>
              <td className="px-4 py-3 text-text-muted">{member.email}</td>
              <td className="px-4 py-3 capitalize text-text">{roleLabel(member.role)}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-small ${
                    member.isActive
                      ? "bg-success/10 text-success"
                      : "bg-error/10 text-error"
                  }`}
                >
                  {member.isActive ? "Active" : "Deactivated"}
                </span>
              </td>
              <td className="px-4 py-3 text-text-muted">{formatLastLogin(member.lastLoginAt)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-3 text-small">
                  {canManage(member) && (
                    <button
                      type="button"
                      onClick={() => onEdit(member)}
                      className="text-secondary hover:underline"
                    >
                      Edit
                    </button>
                  )}
                  {canManage(member) && member.id !== actorId && (
                    <button
                      type="button"
                      onClick={() => (member.isActive ? onDeactivate(member) : onReactivate(member))}
                      className={member.isActive ? "text-error hover:underline" : "text-success hover:underline"}
                    >
                      {member.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
