"use client";

import { useState } from "react";
import Image from "next/image";
import type { CartItem, DiningContext, DiningMenuItem } from "@/lib/dining/types";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

function DishPhoto({ item }: { item: DiningMenuItem }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-background">
      {item.imageUrl && !failed ? (
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          unoptimized
          sizes="(max-width: 640px) 45vw, 260px"
          onError={() => setFailed(true)}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-primary/50">
          <svg viewBox="0 0 64 64" className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 35h48c-2 13-11 19-24 19S10 48 8 35Z" />
            <path d="M6 35h52M22 26c-5-6 6-9 0-15m10 15c-5-6 6-9 0-15m10 15c-5-6 6-9 0-15" />
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-widest">From our kitchen</span>
        </div>
      )}
    </div>
  );
}

export function GuestMenu({ context, cart, busy, onCustomize, onReview }: { context: DiningContext; cart: CartItem[]; busy: boolean; onCustomize: (item: DiningMenuItem) => void; onReview: () => void }) {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const quantity = cart.reduce((sum, item) => sum + item.qty, 0);
  const categories = Array.from(new Map(context.menu.map((item) => [item.categoryId, item.categoryName])).entries());
  const menu = context.menu.filter((item) => (category === "all" || item.categoryId === category) && `${item.name} ${item.description ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 pb-24 lg:pb-0">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Fresh from our kitchen</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold">What sounds good?</h1>
          </div>

          <div className="mb-4">
            <label className="sr-only" htmlFor="menu-search">Search menu</label>
            <Input
              id="menu-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your favourites…"
              className="rounded-full"
            />
          </div>

          <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
            {[["all", "All menu"], ...categories].map(([id, name]) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                className={category === id ? "border-primary text-primary" : "border-transparent"}
                onClick={() => setCategory(id)}
              >
                {name}
              </Button>
            ))}
          </div>

          {!menu.length ? (
            <div className="rounded-3xl bg-surface p-8 text-center text-text-muted">
              {context.menu.length ? "No dishes match your search." : "The menu is not available yet. Please ask your waiter."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
              {menu.map((item) => (
                <Card key={item.id} className="group overflow-hidden rounded-2xl p-0">
                  <DishPhoto item={item} />
                  <div className="p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span aria-label={item.type} className={`h-2 w-2 shrink-0 rounded-full ${item.type === "veg" ? "bg-success" : "bg-error"}`} />
                      <h2 className="text-sm font-semibold leading-snug">{item.name}</h2>
                    </div>
                    <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-text-muted">
                      {item.description || `Prepared fresh · about ${item.prepMinutes} min`}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm">{formatMoney(item.price)}</strong>
                      <Button
                        type="button"
                        variant="accent"
                        disabled={busy}
                        onClick={() => onCustomize(item)}
                        aria-label={`Add ${item.name}`}
                        className="px-4"
                      >
                        + Add
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <aside className="hidden lg:block">
          <Card className="glass-elevated sticky top-24 rounded-3xl p-5">
            <h2 className="font-heading text-lg font-semibold">Your order</h2>
            <div className="mt-4 space-y-3">
              {cart.length ? (
                cart.map((item) => (
                  <div key={item.key} className="flex justify-between gap-3 border-b border-border pb-3 text-sm">
                    <div><span className="font-semibold text-primary">{item.qty}× </span>{item.name}</div>
                    <strong>{formatMoney(item.price * item.qty)}</strong>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-text-muted">Something delicious belongs here.<br />Add your first dish.</p>
              )}
            </div>
            <div className="mt-4 flex justify-between font-semibold">
              <span>Subtotal</span>
              <span>{formatMoney(total)}</span>
            </div>
            <Button type="button" variant="accent" size="lg" className="mt-4 w-full" disabled={!cart.length} onClick={onReview}>
              Review order
            </Button>
            <p className="mt-3 text-center text-xs text-text-muted">Pay at the counter after your meal.</p>
          </Card>
        </aside>
      </div>

      <div className="glass-elevated fixed inset-x-2 bottom-2 z-20 rounded-3xl border border-white/85 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <Button
          type="button"
          variant="accent"
          size="lg"
          disabled={!cart.length}
          onClick={onReview}
          className="flex w-full items-center justify-between"
        >
          <span>{quantity} items · View order</span>
          <span>{formatMoney(total)}</span>
        </Button>
      </div>
    </>
  );
}
