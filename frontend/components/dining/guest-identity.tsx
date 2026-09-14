"use client";

import { useState } from "react";
import type { DiningCustomer } from "@/lib/dining/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function GuestIdentity({ onContinue }: { onContinue: (customer: DiningCustomer) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  return (
    <Card className="mx-auto max-w-lg rounded-3xl p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Welcome to your table</p>
      <h1 className="mt-3 font-heading text-3xl font-semibold">Let’s get you seated.</h1>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">One name and phone number for your group. Next, choose a whole table or just the chairs you need.</p>

      <form
        className="mt-6 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          const cleaned = phone.replace(/[\s()-]/g, "");
          if (!/^(?:[6-9]\d{9}|\+[1-9]\d{7,14})$/.test(cleaned)) {
            setError("Enter a valid Indian mobile number, or include your country code (for example +44).");
            return;
          }
          setError("");
          onContinue({ name: name.trim(), phone: cleaned });
        }}
      >
        <div>
          <Label htmlFor="guest-name" className="mb-2">Your name</Label>
          <Input
            id="guest-name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={100}
            placeholder="Name for this booking"
          />
        </div>

        <div>
          <Label htmlFor="guest-phone" className="mb-2">Mobile number</Label>
          <Input
            id="guest-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            maxLength={24}
            placeholder="98765 43210"
            aria-describedby="phone-purpose"
          />
          <p id="phone-purpose" className="mt-2 text-xs leading-relaxed text-text-muted">
            Used by the restaurant to recognise your visits and manage this booking. This does not subscribe you to promotional messages.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" variant="default" size="lg" className="w-full" disabled={name.trim().length < 2}>
          Continue to seating <span aria-hidden="true">→</span>
        </Button>
      </form>
    </Card>
  );
}
