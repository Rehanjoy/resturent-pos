"use client";

import { useState } from "react";
import type { RestaurantAddress, RestaurantSettings } from "@/lib/settings/types";

export interface ProfileFormValues {
  name: string;
  address: RestaurantAddress;
  gstNumber: string;
  logoUrl: string;
}

/**
 * Restaurant identity — name, address, GST number, logo. Owner-only edit
 * (see the judgment call documented in `backend/src/routes/settings.routes.ts`);
 * a Manager sees the same fields read-only.
 */
export function ProfileForm({
  settings,
  canEdit,
  onSubmit,
  isSubmitting,
  errorMessage,
  successMessage,
}: {
  settings: RestaurantSettings;
  canEdit: boolean;
  onSubmit: (values: ProfileFormValues) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
}) {
  const [name, setName] = useState(settings.name);
  const [line1, setLine1] = useState(settings.address?.line1 ?? "");
  const [line2, setLine2] = useState(settings.address?.line2 ?? "");
  const [city, setCity] = useState(settings.address?.city ?? "");
  const [state, setState] = useState(settings.address?.state ?? "");
  const [postalCode, setPostalCode] = useState(settings.address?.postalCode ?? "");
  const [country, setCountry] = useState(settings.address?.country ?? "");
  const [gstNumber, setGstNumber] = useState(settings.gstNumber ?? "");
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");

  return (
    <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <h2 className="font-heading text-h3 font-semibold text-text">Restaurant Profile</h2>
      {!canEdit && (
        <p className="mt-1 text-small text-text-muted">
          View only — ask an Owner to change these details.
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            name: name.trim(),
            address: {
              line1: line1.trim() || undefined,
              line2: line2.trim() || undefined,
              city: city.trim() || undefined,
              state: state.trim() || undefined,
              postalCode: postalCode.trim() || undefined,
              country: country.trim() || undefined,
            },
            gstNumber: gstNumber.trim(),
            logoUrl: logoUrl.trim(),
          });
        }}
        className="mt-4 flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Restaurant name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!canEdit}
            required
            className="rounded-md border border-border px-3 py-2 text-body text-text disabled:bg-background disabled:text-text-muted"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Address line 1</span>
            <input
              value={line1}
              onChange={(event) => setLine1(event.target.value)}
              disabled={!canEdit}
              className="rounded-md border border-border px-3 py-2 text-body text-text disabled:bg-background disabled:text-text-muted"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Address line 2</span>
            <input
              value={line2}
              onChange={(event) => setLine2(event.target.value)}
              disabled={!canEdit}
              className="rounded-md border border-border px-3 py-2 text-body text-text disabled:bg-background disabled:text-text-muted"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">City</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              disabled={!canEdit}
              className="rounded-md border border-border px-3 py-2 text-body text-text disabled:bg-background disabled:text-text-muted"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">State</span>
            <input
              value={state}
              onChange={(event) => setState(event.target.value)}
              disabled={!canEdit}
              className="rounded-md border border-border px-3 py-2 text-body text-text disabled:bg-background disabled:text-text-muted"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Postal code</span>
            <input
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              disabled={!canEdit}
              className="rounded-md border border-border px-3 py-2 text-body text-text disabled:bg-background disabled:text-text-muted"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Country</span>
            <input
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              disabled={!canEdit}
              className="rounded-md border border-border px-3 py-2 text-body text-text disabled:bg-background disabled:text-text-muted"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">GST number</span>
          <input
            value={gstNumber}
            onChange={(event) => setGstNumber(event.target.value)}
            disabled={!canEdit}
            placeholder="e.g. 27ABCDE1234F1Z5"
            className="rounded-md border border-border px-3 py-2 text-body text-text disabled:bg-background disabled:text-text-muted"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Logo URL</span>
          <input
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            disabled={!canEdit}
            placeholder="https://…"
            className="rounded-md border border-border px-3 py-2 text-body text-text disabled:bg-background disabled:text-text-muted"
          />
          <span className="text-small text-text-muted">
            Direct image upload isn&apos;t built yet (needs S3/cloud storage wiring, deferred like
            the Menu module&apos;s dish photos) — paste a hosted image URL for now.
          </span>
        </label>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}
        {successMessage && <p className="text-small text-success">{successMessage}</p>}

        {canEdit && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="rounded-md bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
            >
              {isSubmitting ? "Saving…" : "Save Profile"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
