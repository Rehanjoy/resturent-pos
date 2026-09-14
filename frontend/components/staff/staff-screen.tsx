"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api";
import { staffApi, type CreateStaffInput, type UpdateStaffInput } from "@/lib/staff/api";
import { MANAGER_ASSIGNABLE_ROLES, type StaffMember } from "@/lib/staff/types";
import { PageHeader } from "@/components/ui/page-header";
import { PlusIcon } from "@/components/icons";
import { StaffTable } from "./staff-table";
import { StaffFormModal, type StaffFormValues } from "./staff-form-modal";
import { StaffDetailDrawer } from "./staff-detail-drawer";
import { TemporaryPasswordModal } from "./temporary-password-modal";

const ACCESS_ROLES = new Set(["owner", "manager"]);

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Staff Management (PRD §3.11). Owner/Manager only per the PRD §2 RBAC
 * matrix — every other role has no nav entry (see `admin/layout.tsx`) and
 * lands here on a plain "no access" message if they hit the URL directly.
 */
export function StaffScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [formModal, setFormModal] = useState<{ mode: "add" | "edit"; staff: StaffMember | null } | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [detailStaff, setDetailStaff] = useState<StaffMember | null>(null);
  const [temporaryPasswordNotice, setTemporaryPasswordNotice] = useState<{
    staffName: string;
    password: string;
  } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const canAccess = !!user && ACCESS_ROLES.has(user.role);

  const staffQuery = useQuery({
    queryKey: ["staff"],
    queryFn: () => staffApi.list(),
    enabled: canAccess,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateStaffInput) => staffApi.create(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setFormModal(null);
      setFormError(null);
      if (result.temporaryPassword) {
        setTemporaryPasswordNotice({
          staffName: result.staff.name,
          password: result.temporaryPassword,
        });
      }
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not add this staff member.")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateStaffInput }) => staffApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setFormModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not update this staff member.")),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => staffApi.deactivate(id),
    onSuccess: () => {
      setStatusError(null);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error) => setStatusError(errorMessageOf(error, "Could not deactivate this account.")),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => staffApi.reactivate(id),
    onSuccess: () => {
      setStatusError(null);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error) => setStatusError(errorMessageOf(error, "Could not reactivate this account.")),
  });

  if (!user) return null;

  if (!canAccess) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-body text-error">You don&apos;t have access to Staff Management.</p>
      </main>
    );
  }

  function handleFormSubmit(values: StaffFormValues) {
    if (formModal?.mode === "add") {
      createMutation.mutate({
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        role: values.role,
        visibleModules: values.visibleModules,
        password: values.password || undefined,
      });
    } else if (formModal?.staff) {
      updateMutation.mutate({
        id: formModal.staff.id,
        input: { name: values.name, phone: values.phone || undefined, role: values.role, visibleModules: values.visibleModules },
      });
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <PageHeader
        title="Staff"
        subtitle="Add, edit, and deactivate staff accounts. Owner and Manager accounts can only be managed by an Owner."
        action={
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setFormModal({ mode: "add", staff: null });
            }}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary"
          >
            <PlusIcon className="h-4 w-4" />
            Add Staff
          </button>
        }
      />

      {statusError && <p className="text-small text-error">{statusError}</p>}

      {staffQuery.isLoading && <p className="text-small text-text-muted">Loading staff…</p>}

      {staffQuery.isError && (
        <p className="text-small text-error">
          Could not load staff — check your connection and try again.
        </p>
      )}

      {staffQuery.data && staffQuery.data.staff.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-muted">
            No staff accounts yet. Add your first team member to get started.
          </p>
          <button
            type="button"
            onClick={() => setFormModal({ mode: "add", staff: null })}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-button text-white shadow-sm transition-colors hover:bg-primary"
          >
            Add Staff
          </button>
        </div>
      )}

      {staffQuery.data && staffQuery.data.staff.length > 0 && (
        <StaffTable
          staff={staffQuery.data.staff}
          actorRole={user.role}
          actorId={user.id}
          onView={(member) => setDetailStaff(member)}
          onEdit={(member) => {
            setFormError(null);
            setFormModal({ mode: "edit", staff: member });
          }}
          onDeactivate={(member) => {
            if (window.confirm(`Deactivate ${member.name}? They will be signed out everywhere.`)) {
              deactivateMutation.mutate(member.id);
            }
          }}
          onReactivate={(member) => {
            if (window.confirm(`Reactivate ${member.name}?`)) {
              reactivateMutation.mutate(member.id);
            }
          }}
        />
      )}

      {formModal && (
        <StaffFormModal
          staff={formModal.staff}
          actorRole={user.role}
          onClose={() => {
            setFormModal(null);
            setFormError(null);
          }}
          onSubmit={handleFormSubmit}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          errorMessage={formError}
        />
      )}

      {detailStaff && (
        <StaffDetailDrawer
          staff={detailStaff}
          canManage={user.role === "owner" || MANAGER_ASSIGNABLE_ROLES.includes(detailStaff.role)}
          onClose={() => setDetailStaff(null)}
        />
      )}

      {temporaryPasswordNotice && (
        <TemporaryPasswordModal
          staffName={temporaryPasswordNotice.staffName}
          password={temporaryPasswordNotice.password}
          onClose={() => setTemporaryPasswordNotice(null)}
        />
      )}
    </main>
  );
}
