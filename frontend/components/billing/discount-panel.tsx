"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { billingApi, type GenerateInvoiceInput } from "@/lib/billing/api";
import type { DiscountType, Invoice } from "@/lib/billing/types";
import { formatMoney, rupeesToPaise } from "@/lib/format";
import { ManagerApprovalModal } from "./manager-approval-modal";

// Quick-pick percent shortcuts (reference screenshot's discount pills) —
// purely a UX shortcut that fills the same `discountValue` input the
// manager-approval-threshold logic already reads from
// `buildDiscount()`/the backend's `discountExceedsThreshold` check below.
// Doesn't add a new discount mechanism or bypass anything: picking "15%"
// here is identical to a cashier typing "15" into the percent field by
// hand.
const QUICK_DISCOUNT_PERCENTS = [
  { label: "None", value: "" },
  { label: "5%", value: "5" },
  { label: "10%", value: "10" },
  { label: "15%", value: "15" },
];

/**
 * Pre-generate step of Settle Bill: shows the running subtotal from the
 * order, an optional flat/percent discount, and the "Generate Bill" action
 * that calls `POST /api/invoices/:orderId/generate`. Owns the whole
 * discount-approval retry loop locally — if the backend rejects the
 * discount with `DISCOUNT_APPROVAL_REQUIRED`, this shows
 * `ManagerApprovalModal` and retries the same request with verified
 * approver credentials attached, surfacing the exact rejection reason if
 * approval itself fails (wrong password, non-manager account, etc).
 */
export function DiscountPanel({
  orderId,
  subtotal,
  onGenerated,
}: {
  orderId: string;
  subtotal: number;
  onGenerated: (invoice: Invoice) => void;
}) {
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const parsedValue = Number(discountValue);
  const hasDiscount = discountValue.trim() !== "" && !Number.isNaN(parsedValue) && parsedValue > 0;

  function buildDiscount(): GenerateInvoiceInput["discount"] {
    if (!hasDiscount) return undefined;
    return {
      type: discountType,
      value: discountType === "percent" ? parsedValue : rupeesToPaise(parsedValue),
    };
  }

  const generateMutation = useMutation({
    mutationFn: (approver?: { approverEmail: string; approverPassword: string }) =>
      billingApi.generateInvoice(orderId, {
        discount: buildDiscount(),
        ...approver,
      }),
    onSuccess: (result) => {
      setGenerateError(null);
      setApprovalError(null);
      setApprovalOpen(false);
      onGenerated(result.invoice);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "DISCOUNT_APPROVAL_REQUIRED") {
        setApprovalOpen(true);
        return;
      }
      if (error instanceof ApiError && error.code === "DISCOUNT_APPROVAL_INVALID") {
        setApprovalError(error.message);
        return;
      }
      setGenerateError(
        error instanceof ApiError ? error.message : "Could not generate the bill. Try again.",
      );
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-1.5 text-small font-semibold uppercase tracking-wide text-text-muted">
          Bill Summary
        </h3>
        <div className="flex items-center justify-between text-body">
          <span className="text-text-muted">Subtotal</span>
          <span className="text-numeric font-semibold text-text">{formatMoney(subtotal)}</span>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="text-small font-medium text-text">Discount (optional)</legend>

        <div className="flex gap-2">
          {(["percent", "flat"] as DiscountType[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDiscountType(option)}
              className={`rounded-full border px-3 py-1.5 text-small font-medium capitalize transition-colors ${
                discountType === option
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-text-muted hover:border-primary/50"
              }`}
            >
              {option === "percent" ? "Percent" : "Flat (₹)"}
            </button>
          ))}
        </div>

        {/* Quick-pick shortcuts (reference screenshot) — only meaningful
            for the percent flow; flat discounts stay free-typed since a
            fixed "5/10/15" wouldn't map to a sensible rupee amount across
            different bill sizes. */}
        {discountType === "percent" && (
          <div className="flex flex-wrap gap-1.5">
            {QUICK_DISCOUNT_PERCENTS.map((quick) => (
              <button
                key={quick.label}
                type="button"
                onClick={() => setDiscountValue(quick.value)}
                className={`rounded-full border px-2.5 py-1 text-small transition-colors ${
                  discountValue === quick.value
                    ? "border-secondary bg-secondary/10 text-secondary"
                    : "border-border text-text-muted hover:border-secondary/50"
                }`}
              >
                {quick.label}
              </button>
            ))}
          </div>
        )}

        <input
          type="number"
          min={0}
          max={discountType === "percent" ? 100 : undefined}
          step={discountType === "percent" ? 1 : 0.01}
          value={discountValue}
          onChange={(event) => setDiscountValue(event.target.value)}
          placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 100.00"}
          className="rounded-lg border border-border px-3 py-2 text-body text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </fieldset>

      {generateError && <p className="text-small text-error">{generateError}</p>}

      <button
        type="button"
        disabled={generateMutation.isPending}
        onClick={() => {
          setGenerateError(null);
          generateMutation.mutate(undefined);
        }}
        className="w-full rounded-lg bg-accent px-4 py-3 text-button text-white shadow-sm transition-colors hover:bg-primary disabled:opacity-50"
      >
        {generateMutation.isPending ? "Generating…" : "Generate Bill"}
      </button>

      {approvalOpen && (
        <ManagerApprovalModal
          onClose={() => {
            setApprovalOpen(false);
            setApprovalError(null);
          }}
          isSubmitting={generateMutation.isPending}
          errorMessage={approvalError}
          onConfirm={(approverEmail, approverPassword) => {
            setApprovalError(null);
            generateMutation.mutate({ approverEmail, approverPassword });
          }}
        />
      )}
    </div>
  );
}
