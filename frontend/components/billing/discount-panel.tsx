"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { billingApi, type GenerateInvoiceInput } from "@/lib/billing/api";
import type { DiscountType, Invoice } from "@/lib/billing/types";
import { formatMoney, rupeesToPaise } from "@/lib/format";
import { ManagerApprovalModal } from "./manager-approval-modal";

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-body">
        <span className="text-text-muted">Subtotal</span>
        <span className="text-numeric font-semibold text-text">{formatMoney(subtotal)}</span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-medium text-text">Discount (optional)</legend>
        <div className="flex gap-2">
          {(["percent", "flat"] as DiscountType[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDiscountType(option)}
              className={`rounded-full border px-3 py-1.5 text-small capitalize ${
                discountType === option
                  ? "border-primary text-primary"
                  : "border-border text-text-muted"
              }`}
            >
              {option === "percent" ? "Percent" : "Flat (₹)"}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={0}
          max={discountType === "percent" ? 100 : undefined}
          step={discountType === "percent" ? 1 : 0.01}
          value={discountValue}
          onChange={(event) => setDiscountValue(event.target.value)}
          placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 100.00"}
          className="rounded-md border border-border px-3 py-2 text-body text-text"
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
        className="w-full rounded-md bg-accent px-4 py-3 text-button text-white disabled:opacity-50"
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
