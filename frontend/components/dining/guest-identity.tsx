"use client";

import { useState } from "react";
import type { DiningCustomer } from "@/lib/dining/types";

export function GuestIdentity({ onContinue }: { onContinue: (customer: DiningCustomer) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  return <section className="mx-auto max-w-lg rounded-3xl border border-border bg-surface p-6 sm:p-8">
    <p className="text-xs font-semibold uppercase tracking-widest text-primary">Welcome to your table</p>
    <h1 className="mt-3 font-heading text-3xl font-semibold">Let’s get you seated.</h1>
    <p className="mt-3 text-sm leading-relaxed text-text-muted">One name and phone number for your group. Next, choose a whole table or just the chairs you need.</p>
    <form className="mt-6 space-y-5" onSubmit={event => {
      event.preventDefault();
      const cleaned = phone.replace(/[\s()-]/g, "");
      if (!/^(?:[6-9]\d{9}|\+[1-9]\d{7,14})$/.test(cleaned)) { setError("Enter a valid Indian mobile number, or include your country code (for example +44)."); return; }
      setError(""); onContinue({ name: name.trim(), phone: cleaned });
    }}>
      <label className="block text-sm font-semibold">Your name<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={100} placeholder="Name for this booking" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background/50 px-4 font-normal" /></label>
      <label className="block text-sm font-semibold">Mobile number<input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} required maxLength={24} placeholder="98765 43210" aria-describedby="phone-purpose" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background/50 px-4 font-normal" /></label>
      <p id="phone-purpose" className="text-xs leading-relaxed text-text-muted">Used by the restaurant to recognise your visits and manage this booking. This does not subscribe you to promotional messages.</p>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <button disabled={name.trim().length < 2} className="min-h-12 w-full rounded-full bg-primary px-5 font-semibold text-white disabled:opacity-40">Continue to seating <span aria-hidden="true">→</span></button>
    </form>
  </section>;
}
