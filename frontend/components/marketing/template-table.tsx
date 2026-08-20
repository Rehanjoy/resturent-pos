"use client";

import type { MessageTemplate, MessageTemplateStatus } from "@/lib/marketing/types";
import { TemplateBodyPreview } from "./template-body-preview";

const STATUS_LABEL: Record<MessageTemplateStatus, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
};

// Approved reads as "safe to send" (success); pending is Meta still
// reviewing it (warning, matching the low-stock/pending-approval usage
// elsewhere in this app); rejected/paused/disabled all collapse to the
// same "can't send this" error state.
const STATUS_BADGE: Record<MessageTemplateStatus, string> = {
  approved: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  rejected: "bg-error/10 text-error",
};

/**
 * Dense table for the Templates sub-view — mirrors `ContactTable`'s
 * established styling. Read-only: this app never creates/edits/deletes a
 * template locally, only syncs Meta's own catalog
 * (`message-template.service.ts`).
 */
export function TemplateTable({ templates }: { templates: MessageTemplate[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
      <table className="w-full text-left text-body">
        <thead>
          <tr className="border-b border-border text-small font-medium text-text-muted">
            <th className="px-4 py-3">Template</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Language</th>
            <th className="px-4 py-3">Variables</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id} className="border-b border-border align-top last:border-0">
              <td className="px-4 py-3">
                <p className="font-medium text-text">{template.name}</p>
                <div className="mt-1 max-w-md">
                  <TemplateBodyPreview text={template.bodyText} />
                </div>
              </td>
              <td className="px-4 py-3 capitalize text-text-muted">{template.category}</td>
              <td className="px-4 py-3 text-text-muted">{template.language}</td>
              <td className="px-4 py-3 tabular-nums text-text-muted">{template.variableCount}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-small font-medium ${STATUS_BADGE[template.status]}`}
                >
                  {STATUS_LABEL[template.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
