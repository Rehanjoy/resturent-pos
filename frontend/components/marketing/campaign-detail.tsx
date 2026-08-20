"use client";

import { useQuery } from "@tanstack/react-query";
import { marketingApi } from "@/lib/marketing/api";
import type { MessageLogStatus } from "@/lib/marketing/types";
import { StatCard } from "@/components/dashboard/stat-card";
import { DonutChartCard } from "@/components/charts/donut-chart-card";
import { ChevronLeftIcon, ReceiptIcon } from "@/components/icons";

const RECIPIENT_STATUS_LABEL: Record<MessageLogStatus, string> = {
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
};

const RECIPIENT_STATUS_BADGE: Record<MessageLogStatus, string> = {
  sent: "bg-secondary/10 text-secondary",
  delivered: "bg-success/10 text-success",
  read: "bg-primary/10 text-primary",
  failed: "bg-error/10 text-error",
};

/**
 * Campaign detail — the four running counts as stat cards, a delivery
 * status-event breakdown donut, and the per-recipient log (why a send
 * failed, if it did). Counts are independent event tallies, not a funnel
 * that sums to `recipientCount` (see `MarketingCampaign` model's doc
 * comment) — the donut is labeled accordingly rather than implying an
 * exact recipient split.
 */
export function CampaignDetail({ campaignId, onBack }: { campaignId: string; onBack: () => void }) {
  const campaignQuery = useQuery({
    queryKey: ["marketing-campaign", campaignId],
    queryFn: () => marketingApi.getCampaign(campaignId).then((result) => result.campaign),
  });
  const recipientsQuery = useQuery({
    queryKey: ["marketing-campaign-recipients", campaignId],
    queryFn: () => marketingApi.listCampaignRecipients(campaignId, { limit: 50 }),
  });

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-small font-medium text-text-muted hover:text-text"
      >
        <ChevronLeftIcon className="h-4 w-4" /> Back to campaigns
      </button>

      {campaignQuery.isLoading && <p className="text-small text-text-muted">Loading campaign…</p>}
      {campaignQuery.isError && (
        <p className="text-small text-error">Could not load this campaign — check your connection and try again.</p>
      )}

      {campaignQuery.data && (
        <>
          <div>
            <h2 className="font-heading text-h3 font-semibold text-text">{campaignQuery.data.name}</h2>
            <p className="text-small text-text-muted">
              {campaignQuery.data.audienceDescription} · Created{" "}
              {new Date(campaignQuery.data.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Recipients" value={String(campaignQuery.data.recipientCount)} icon={ReceiptIcon} />
            <StatCard label="Sent" value={String(campaignQuery.data.sentCount)} />
            <StatCard label="Delivered" value={String(campaignQuery.data.deliveredCount)} tone="success" />
            <StatCard label="Failed" value={String(campaignQuery.data.failedCount)} tone="error" />
          </div>

          <DonutChartCard
            title="Delivery status events"
            subtitle="A message can trigger more than one status event (sent → delivered → read) — these are event counts, not a recipient split."
            totalLabel="Events"
            valueFormatter={(value) => String(value)}
            emptyMessage="No delivery status events yet."
            data={[
              { key: "delivered", label: "Delivered", value: campaignQuery.data.deliveredCount, color: "var(--color-success)" },
              { key: "read", label: "Read", value: campaignQuery.data.readCount, color: "var(--color-secondary)" },
              { key: "failed", label: "Failed", value: campaignQuery.data.failedCount, color: "var(--color-error)" },
            ]}
          />
        </>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="font-heading text-h4 font-semibold text-text">Recipients</h3>

        {recipientsQuery.isLoading && <p className="text-small text-text-muted">Loading recipients…</p>}
        {recipientsQuery.isError && (
          <p className="text-small text-error">Could not load recipients — check your connection and try again.</p>
        )}
        {recipientsQuery.data && recipientsQuery.data.recipients.length === 0 && (
          <p className="text-small text-text-muted">No recipients on this campaign.</p>
        )}

        {recipientsQuery.data && recipientsQuery.data.recipients.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
            <table className="w-full text-left text-body">
              <thead>
                <tr className="border-b border-border text-small font-medium text-text-muted">
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {recipientsQuery.data.recipients.map((recipient) => (
                  <tr key={recipient.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 tabular-nums text-text">{recipient.phone}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-small font-medium ${RECIPIENT_STATUS_BADGE[recipient.status]}`}
                      >
                        {RECIPIENT_STATUS_LABEL[recipient.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{recipient.failureReason ?? "—"}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(recipient.statusUpdatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
