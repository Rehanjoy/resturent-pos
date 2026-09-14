"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MenuItem } from "@/lib/menu/types";
import { seatingAdminApi } from "@/lib/tables/seating-admin-api";

export function PreparationTimes({ items }: { items: MenuItem[] }) {
  const [itemId, setItemId] = useState("");
  const [minutes, setMinutes] = useState(15);
  const cache = useQueryClient();
  const save = useMutation({
    mutationFn: () => seatingAdminApi.preparation(itemId, minutes),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["menuItems"] }),
  });

  return (
    <details className="rounded-2xl border border-border bg-white p-5">
      <summary className="cursor-pointer font-semibold">Dish preparation times</summary>
      <p className="mb-4 mt-2 text-sm text-text-muted">
        Set the estimate guests see for each dish. Chefs can adjust a live item&apos;s remaining
        time in Kitchen.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="min-w-40 flex-1 text-sm">
          Dish
          <select
            required
            value={itemId}
            onChange={(event) => {
              setItemId(event.target.value);
              setMinutes(items.find((item) => item.id === event.target.value)?.prepMinutes ?? 15);
              save.reset();
            }}
            className="mt-1 block w-full rounded-xl border border-border px-3"
          >
            <option value="">Choose a dish</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}{item.prepMinutes ? ` · ${item.prepMinutes} min` : " · default"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Minutes
          <input
            type="number"
            min="1"
            max="240"
            required
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
            className="mt-1 block w-24 rounded-xl border border-border px-3"
          />
        </label>
        <button
          disabled={!itemId || save.isPending}
          className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save estimate"}
        </button>
      </form>
      {save.isError && <p role="alert" className="mt-3 text-sm text-error">{save.error.message}</p>}
      {save.isSuccess && <p role="status" className="mt-3 text-sm text-success">Preparation estimate saved.</p>}
    </details>
  );
}
