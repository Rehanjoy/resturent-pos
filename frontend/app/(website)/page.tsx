"use client";

import React, { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/auth/api";
import { setAccessToken, setStoredUser } from "@/lib/auth/token-store";
import {
  Receipt,
  UtensilsCrossed,
  ChefHat,
  Flame,
  QrCode,
  Smartphone,
  Package,
  Boxes,
  LayoutGrid,
  Armchair,
  Users,
  Clock,
  Timer,
  CheckCircle2,
  Check,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Wallet,
  CreditCard,
  MessageSquare,
  MessageCircle,
  Printer,
  Monitor,
  Tablet,
  Tv,
  Bell,
  Sparkles,
  Zap,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  X,
  Menu,
  Coffee,
  Split,
  Percent,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* SAMPLE MOCK DATA FOR INTERACTIVE TERMINAL SCREENS                          */
/* -------------------------------------------------------------------------- */

interface MockCartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  type: "veg" | "non-veg";
  notes?: string;
}

const INITIAL_CART: MockCartItem[] = [
  { id: "1", name: "Smoked Paneer Tikka", price: 340, qty: 2, type: "veg", notes: "Extra mint chutney" },
  { id: "2", name: "Awadhi Dum Biryani", price: 420, qty: 1, type: "non-veg", notes: "Medium spicy" },
  { id: "3", name: "Butter Garlic Naan", price: 85, qty: 4, type: "veg" },
  { id: "4", name: "Rose Pistachio Kulfi", price: 190, qty: 2, type: "veg" },
];

const MENU_CATALOG = [
  { id: "m1", name: "Smoked Paneer Tikka", price: 340, category: "Starters", type: "veg" },
  { id: "m2", name: "Murgh Malai Tikka", price: 390, category: "Starters", type: "non-veg" },
  { id: "m3", name: "Awadhi Dum Biryani", price: 420, category: "Mains", type: "non-veg" },
  { id: "m4", name: "Dal Makhani Royale", price: 310, category: "Mains", type: "veg" },
  { id: "m5", name: "Butter Garlic Naan", price: 85, category: "Breads", type: "veg" },
  { id: "m6", name: "Rose Pistachio Kulfi", price: 190, category: "Desserts", type: "veg" },
  { id: "m7", name: "Smoked Chili Mocktail", price: 160, category: "Drinks", type: "veg" },
];

export default function WebsiteHomePage() {
  // Navigation & Interactive UI state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDemoLaunching, setIsDemoLaunching] = useState(false);
  const [activeScreenTab, setActiveScreenTab] = useState<"pos" | "kds" | "floor" | "qr" | "inventory" | "analytics">("pos");

  const handleLaunchDemo = async () => {
    if (isDemoLaunching) return;
    setIsDemoLaunching(true);
    try {
      const res = await authApi.startDemo("live-tester@qrwikpos.com", "Live Demo Restaurateur");
      setAccessToken(res.accessToken);
      setStoredUser(res.user);
      window.location.href = "/admin";
    } catch {
      window.location.href = "/login?demo=1";
    }
  };

  // POS interactive cart mockup
  const [cartItems, setCartItems] = useState<MockCartItem[]>(INITIAL_CART);
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Floor plan interactive table state
  const [floorSection, setFloorSection] = useState<"main" | "terrace" | "vip">("main");
  const [selectedTableId, setSelectedTableId] = useState<string>("T-04");

  // Kitchen KDS interactive ticket checkoff
  const [kdsTickets, setKdsTickets] = useState([
    {
      id: "TK-108",
      table: "Table 04",
      time: "14m ago",
      station: "Grill & Tandoor",
      urgency: "urgent",
      items: [
        { name: "2x Smoked Paneer Tikka", done: true },
        { name: "4x Butter Garlic Naan", done: false },
        { name: "1x Dal Makhani Royale", done: false },
      ],
    },
    {
      id: "TK-109",
      table: "Table 08",
      time: "7m ago",
      station: "Biryani & Curry",
      urgency: "normal",
      items: [
        { name: "1x Awadhi Dum Biryani", done: false },
        { name: "1x Burani Raita", done: true },
      ],
    },
    {
      id: "TK-110",
      table: "Takeaway #42",
      time: "2m ago",
      station: "Dessert & Bar",
      urgency: "fresh",
      items: [
        { name: "2x Rose Pistachio Kulfi", done: false },
        { name: "2x Smoked Chili Mocktail", done: false },
      ],
    },
  ]);

  // ROI Calculator state
  const [calcTables, setCalcTables] = useState<number>(25);

  // FAQ Accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Calculations for mock cart
  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.qty, 0);
  const gst = Math.round(subtotal * 0.05);
  const serviceCharge = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + gst + serviceCharge;

  const handleUpdateQty = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const handleAddItem = (dish: (typeof MENU_CATALOG)[0]) => {
    setCartItems((prev) => {
      const exists = prev.find((item) => item.name === dish.name);
      if (exists) {
        return prev.map((item) => (item.id === exists.id ? { ...item, qty: item.qty + 1 } : item));
      }
      return [...prev, { id: `item-${Date.now()}`, name: dish.name, price: dish.price, qty: 1, type: dish.type as "veg" | "non-veg" }];
    });
  };

  const toggleKdsItem = (ticketId: string, itemIndex: number) => {
    setKdsTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        const newItems = [...t.items];
        newItems[itemIndex] = { ...newItems[itemIndex], done: !newItems[itemIndex].done };
        return { ...t, items: newItems };
      })
    );
  };

  return (
    <div className="ambient-shell min-h-screen bg-[#fff7f4] text-[#191919] selection:bg-[#e53e15]/20 selection:text-[#191919]">
      {/* ==================================================================== */}
      {/* 1. TOP FLOATING NAVIGATION BAR                                       */}
      {/* ==================================================================== */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6">
        <nav
          aria-label="Main navigation"
          className="glass-panel mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white/85 bg-white/78 px-4 shadow-[0_12px_32px_rgba(86,43,25,0.06)] backdrop-blur-2xl sm:px-6"
        >
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 py-1 group">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#e53e15] to-[#ff6b42] text-white shadow-md shadow-[#e53e15]/25 transition-transform group-hover:scale-105">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-lg font-bold tracking-tight text-[#191919]">
                QRWIK<span className="text-[#e53e15]">-POS</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#706b69]">
                Restaurant OS
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden items-center gap-6 text-sm font-medium text-[#706b69] lg:flex">
            <a href="#screens" className="transition-colors hover:text-[#e53e15]">
              Live Screens
            </a>
            <a href="#features" className="transition-colors hover:text-[#e53e15]">
              Core Modules
            </a>
            <a href="#flow" className="transition-colors hover:text-[#e53e15]">
              Order Journey
            </a>
            <a href="#calculator" className="transition-colors hover:text-[#e53e15]">
              ROI Calculator
            </a>
            <a href="#hardware" className="transition-colors hover:text-[#e53e15]">
              Hardware
            </a>
            <a href="#faq" className="transition-colors hover:text-[#e53e15]">
              FAQ
            </a>
          </div>

          {/* Action Buttons: Exactly 2 buttons (Try Demo & Login) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleLaunchDemo}
              disabled={isDemoLaunching}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-gradient-to-r from-[#e53e15] to-[#ff4b24] px-5 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(229,62,21,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(229,62,21,0.36)] active:scale-95 disabled:opacity-75"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>{isDemoLaunching ? "Starting Demo..." : "Try Demo"}</span>
            </button>
            <Link
              href="/login"
              className="inline-flex min-h-10 items-center rounded-full border border-neutral-300 bg-white/80 px-4 text-xs font-semibold text-neutral-800 shadow-sm hover:bg-white hover:border-neutral-400 transition"
            >
              Login
            </Link>

            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white/80 text-neutral-700 lg:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="mx-auto mt-2 max-w-7xl rounded-2xl border border-white/90 bg-white/95 p-5 shadow-2xl backdrop-blur-xl lg:hidden">
            <div className="flex flex-col gap-3 font-medium text-neutral-800">
              <a
                href="#screens"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-2 hover:bg-neutral-100"
              >
                Live Screen Mockups
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-2 hover:bg-neutral-100"
              >
                Core Modules &amp; Features
              </a>
              <a
                href="#flow"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-2 hover:bg-neutral-100"
              >
                Order Lifecycle Flow
              </a>
              <a
                href="#calculator"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-2 hover:bg-neutral-100"
              >
                ROI &amp; Savings Calculator
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-2 hover:bg-neutral-100"
              >
                Frequently Asked Questions
              </a>
              <div className="mt-2 flex flex-col gap-2 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={handleLaunchDemo}
                  disabled={isDemoLaunching}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e53e15] to-[#ff4b24] font-semibold text-white shadow-md"
                >
                  <Zap className="h-4 w-4" />
                  <span>{isDemoLaunching ? "Starting Demo..." : "Try Demo"}</span>
                </button>
                <Link
                  href="/login"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white font-semibold text-neutral-800"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ==================================================================== */}
      {/* 2. HERO SECTION                                                      */}
      {/* ==================================================================== */}
      <section className="relative mx-auto max-w-7xl px-4 pt-28 pb-12 sm:px-6 sm:pt-36 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Release Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e53e15]/25 bg-gradient-to-r from-[#e53e15]/10 via-[#ff4b24]/5 to-transparent px-4 py-1.5 text-xs font-semibold text-[#e53e15] shadow-sm backdrop-blur-xl">
            <Zap className="h-3.5 w-3.5 text-[#e53e15]" />
            <span>QRWIK-POS v2.4 • The High-Speed Operating System for Smart Restaurants</span>
          </div>

          {/* Master Heading */}
          <h1 className="mt-6 font-heading text-[clamp(2.4rem,6vw,4.8rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-[#191919]">
            The Complete Restaurant POS. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-[#e53e15] via-[#ff4b24] to-[#f59e0b] bg-clip-text text-transparent">
              Lightning Fast. Beautiful. Unstoppable.
            </span>
          </h1>

          {/* Subheading */}
          <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed text-[#706b69]">
            Unify high-speed order punching, chair-level QR self-ordering, real-time Kitchen KDS routing,
            and recipe-level ingredient inventory in one live cloud-synced workspace.
          </p>

          {/* Primary Action Button: Exactly ONE button "Demo Now" */}
          <div className="mt-8 flex items-center justify-center">
            <button
              type="button"
              onClick={handleLaunchDemo}
              disabled={isDemoLaunching}
              className="inline-flex min-h-13 items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#e53e15] via-[#ff4b24] to-[#e53e15] px-10 py-3.5 text-base font-bold text-white shadow-[0_14px_34px_rgba(229,62,21,0.38)] transition-all hover:scale-105 hover:shadow-[0_18px_42px_rgba(229,62,21,0.48)] active:scale-95 disabled:opacity-75"
            >
              <Zap className="h-5 w-5" />
              <span>{isDemoLaunching ? "Launching 1-Hour Live Demo..." : "Demo Now"}</span>
            </button>
          </div>

          {/* Feature Highlight Pills */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs font-semibold text-[#706b69]">
            <span className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-[#15803d]" /> &lt;0.4s Order Punch Time
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-[#15803d]" /> Chair-Level QR Seating
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-[#15803d]" /> Station-Wise KDS Routing
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-[#15803d]" /> Recipe Raw Material Auto-BOM
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-[#15803d]" /> GST &amp; Split-Tender Ready
            </span>
          </div>
        </div>

        {/* ================================================================== */}
        {/* 3. INTERACTIVE TERMINAL SCREENS SHOWCASE                           */}
        {/* ================================================================== */}
        <div id="screens" className="mt-14 scroll-mt-24">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] border border-white/90 bg-white/60 p-3 sm:p-5 shadow-[0_24px_70px_rgba(86,43,25,0.12)] backdrop-blur-2xl">
            {/* Ambient background glow */}
            <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#e53e15]/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-[#1f7a8c]/15 blur-3xl" />

            {/* Window Top Chrome */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-4 px-2 sm:px-4">
              {/* Window dots & Status */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-[#ef4444]" />
                  <span className="h-3 w-3 rounded-full bg-[#f59e0b]" />
                  <span className="h-3 w-3 rounded-full bg-[#10b981]" />
                </div>
                <div className="hidden sm:flex items-center gap-2 rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-xs font-semibold text-neutral-700 shadow-sm">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>QRWIK-POS v2.4 Live Demo</span>
                  <span className="text-neutral-400">•</span>
                  <span className="text-neutral-500">Terminal #01 (Main Dining)</span>
                </div>
              </div>

              {/* Interactive Screen Selector Tabs */}
              <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-neutral-200/90 bg-neutral-100/90 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveScreenTab("pos")}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition-all ${
                    activeScreenTab === "pos"
                      ? "bg-white text-[#e53e15] shadow-sm font-bold"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <Receipt className="h-3.5 w-3.5" />
                  <span>1. POS Billing Terminal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreenTab("kds")}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition-all ${
                    activeScreenTab === "kds"
                      ? "bg-white text-[#e53e15] shadow-sm font-bold"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <Flame className="h-3.5 w-3.5" />
                  <span>2. Kitchen KDS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreenTab("floor")}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition-all ${
                    activeScreenTab === "floor"
                      ? "bg-white text-[#e53e15] shadow-sm font-bold"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>3. Floor Plan &amp; Tables</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreenTab("qr")}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition-all ${
                    activeScreenTab === "qr"
                      ? "bg-white text-[#e53e15] shadow-sm font-bold"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>4. QR Self-Order</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreenTab("inventory")}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition-all ${
                    activeScreenTab === "inventory"
                      ? "bg-white text-[#e53e15] shadow-sm font-bold"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <Boxes className="h-3.5 w-3.5" />
                  <span>5. Recipe Inventory BOM</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreenTab("analytics")}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 transition-all ${
                    activeScreenTab === "analytics"
                      ? "bg-white text-[#e53e15] shadow-sm font-bold"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>6. Sales Cockpit</span>
                </button>
              </div>
            </div>

            {/* SCREEN 1: POS TERMINAL */}
            {activeScreenTab === "pos" && (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-[#1c1816] text-white p-4 sm:p-6 shadow-inner">
                {/* POS Subheader */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 font-bold">
                      T-04
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading text-base font-semibold">Table 04 • Indoor Dining</h3>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          Active (Dine-in)
                        </span>
                      </div>
                      <p className="text-xs text-white/50">Captain: Vikram S. • Covers: 4 Guests • Time: 19:42</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                      <Zap className="h-3.5 w-3.5 text-orange-400" />
                      <span>0.3s Punch Latency</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCartItems(INITIAL_CART)}
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/20"
                    >
                      Reset Mock Cart
                    </button>
                  </div>
                </div>

                {/* POS Dual Column: Menu Catalog (Left) + Active Ticket Cart (Right) */}
                <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
                  {/* Left: Menu Catalog with Quick Add */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                        Fast Item Punching (Click to add)
                      </p>
                      <div className="flex gap-1 text-[11px]">
                        {["All", "Starters", "Mains", "Breads", "Desserts"].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={`rounded-lg px-2.5 py-1 ${
                              selectedCategory === cat
                                ? "bg-orange-500 text-white font-semibold"
                                : "bg-white/10 text-white/60 hover:text-white"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {MENU_CATALOG.filter(
                        (i) => selectedCategory === "All" || i.category === selectedCategory
                      ).map((dish) => (
                        <div
                          key={dish.id}
                          onClick={() => handleAddItem(dish)}
                          className="group flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-orange-500/50 hover:bg-white/10"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                dish.type === "veg" ? "bg-emerald-400" : "bg-red-400"
                              }`}
                            />
                            <div className="truncate">
                              <p className="text-xs font-semibold text-white group-hover:text-orange-300">
                                {dish.name}
                              </p>
                              <p className="text-[11px] text-white/50">₹{dish.price}</p>
                            </div>
                          </div>
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/80 group-hover:bg-orange-500 group-hover:text-white">
                            <Plus className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Running Cart & Checkout Actions */}
                  <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div>
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
                          Active Ticket ({cartItems.length} items)
                        </span>
                        <span className="text-xs font-semibold text-orange-400">Order #108</span>
                      </div>

                      {/* Items list */}
                      <div className="mt-3 space-y-2.5 max-h-56 overflow-y-auto pr-1">
                        {cartItems.length === 0 ? (
                          <p className="py-8 text-center text-xs text-white/40">
                            Cart is empty. Click any item on the left to add.
                          </p>
                        ) : (
                          cartItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] p-2.5 text-xs"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-semibold text-white truncate">{item.name}</p>
                                <p className="text-[11px] text-white/50">
                                  ₹{item.price} each {item.notes && `• ${item.notes}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(item.id, -1)}
                                  className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-4 text-center font-bold text-white tabular-nums">
                                  {item.qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(item.id, 1)}
                                  className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                                <span className="w-14 text-right font-bold text-orange-300 tabular-nums">
                                  ₹{item.price * item.qty}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Summary Totals & Settle Buttons */}
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <div className="space-y-1 text-xs text-white/70">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span className="tabular-nums">₹{subtotal}</span>
                        </div>
                        <div className="flex justify-between text-white/50 text-[11px]">
                          <span>GST (5%) + Service (5%)</span>
                          <span className="tabular-nums">₹{gst + serviceCharge}</span>
                        </div>
                        <div className="flex justify-between font-bold text-sm text-white pt-1 border-t border-white/10">
                          <span>Grand Total</span>
                          <span className="text-orange-400 tabular-nums">₹{grandTotal}</span>
                        </div>
                      </div>

                      {/* Instant Actions */}
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 text-xs font-semibold text-white hover:bg-white/20"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Print KOT</span>
                        </button>
                        <button
                          type="button"
                          className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 text-xs font-semibold text-white hover:bg-white/20"
                        >
                          <Split className="h-3.5 w-3.5" />
                          <span>Split Bill (4 Ways)</span>
                        </button>
                        <button
                          type="button"
                          className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-xs font-bold text-white shadow-lg hover:from-emerald-500 hover:to-emerald-400"
                        >
                          <Wallet className="h-4 w-4" />
                          <span>Settle &amp; Pay ₹{grandTotal} (UPI / Cash / Card)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SCREEN 2: KITCHEN DISPLAY SYSTEM (KDS) */}
            {activeScreenTab === "kds" && (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-[#16191f] text-white p-4 sm:p-6 shadow-inner">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                      <ChefHat className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-heading text-base font-semibold">
                        Kitchen Display System (KDS) • Station View
                      </h3>
                      <p className="text-xs text-white/50">
                        Live Ticket Routing • Auto-Chime Enabled • 3 Active Tickets
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 font-semibold text-emerald-300">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Average Prep: 11 mins</span>
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {kdsTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className={`flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                        ticket.urgency === "urgent"
                          ? "border-red-500/40 bg-red-950/20"
                          : ticket.urgency === "normal"
                          ? "border-amber-500/30 bg-amber-950/20"
                          : "border-emerald-500/30 bg-emerald-950/20"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-white/90">{ticket.id}</span>
                          <span
                            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              ticket.urgency === "urgent"
                                ? "bg-red-500 text-white animate-pulse"
                                : ticket.urgency === "normal"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            <Timer className="h-3 w-3" />
                            <span>{ticket.time}</span>
                          </span>
                        </div>
                        <h4 className="mt-2 font-heading text-lg font-bold text-white">{ticket.table}</h4>
                        <p className="text-xs text-white/50">{ticket.station}</p>

                        <div className="mt-4 space-y-2">
                          {ticket.items.map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => toggleKdsItem(ticket.id, idx)}
                              className={`flex cursor-pointer items-center justify-between rounded-lg p-2 text-xs transition ${
                                item.done
                                  ? "bg-white/5 text-white/40 line-through"
                                  : "bg-white/10 text-white hover:bg-white/15"
                              }`}
                            >
                              <span>{item.name}</span>
                              <span
                                className={`h-4 w-4 rounded border flex items-center justify-center text-[10px] ${
                                  item.done
                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                    : "border-white/30"
                                }`}
                              >
                                {item.done ? <Check className="h-3 w-3" /> : null}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-white/10 flex items-center gap-2">
                        <button
                          type="button"
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2 text-xs font-bold text-white text-center transition"
                        >
                          <Bell className="h-3.5 w-3.5" />
                          <span>Mark Ready (Notify Staff)</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SCREEN 3: FLOOR & TABLE PLAN */}
            {activeScreenTab === "floor" && (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-[#fbf6f0] p-4 sm:p-6 text-neutral-800">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
                  <div>
                    <h3 className="font-heading text-base font-bold text-neutral-900">
                      Interactive Visual Floor &amp; Seating Layout
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Real-time Occupancy • Chair-level Seating • Hold Seats • Quick Table Shift
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-1 text-xs">
                    {(["main", "terrace", "vip"] as const).map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setFloorSection(sec)}
                        className={`rounded-lg px-3 py-1 font-semibold uppercase ${
                          floorSection === sec ? "bg-[#e53e15] text-white" : "text-neutral-600 hover:bg-neutral-100"
                        }`}
                      >
                        {sec} Section
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { id: "T-01", seats: 2, status: "vacant", bill: 0, time: "Ready" },
                    { id: "T-02", seats: 4, status: "occupied", bill: 1850, time: "42m in dining" },
                    { id: "T-03", seats: 6, status: "reserved", bill: 0, time: "Reserved 19:30" },
                    { id: "T-04", seats: 4, status: "billed", bill: 2420, time: "Bill Presented" },
                    { id: "T-05", seats: 4, status: "occupied", bill: 3100, time: "18m in dining" },
                    { id: "T-06", seats: 2, status: "vacant", bill: 0, time: "Ready" },
                    { id: "T-07", seats: 8, status: "occupied", bill: 5640, time: "55m in dining" },
                    { id: "T-08", seats: 4, status: "vacant", bill: 0, time: "Ready" },
                  ].map((table) => {
                    const isSelected = selectedTableId === table.id;
                    const isVacant = table.status === "vacant";
                    const isOccupied = table.status === "occupied";
                    const isBilled = table.status === "billed";
                    const isReserved = table.status === "reserved";

                    return (
                      <div
                        key={table.id}
                        onClick={() => setSelectedTableId(table.id)}
                        className={`cursor-pointer rounded-2xl border-2 p-4 transition-all ${
                          isSelected
                            ? "border-[#e53e15] shadow-lg scale-102 bg-white"
                            : "border-neutral-200 bg-white/70 hover:border-neutral-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-heading text-lg font-bold text-neutral-900">{table.id}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isVacant
                                ? "bg-emerald-100 text-emerald-700"
                                : isOccupied
                                ? "bg-amber-100 text-amber-800"
                                : isBilled
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {table.status}
                          </span>
                        </div>

                        {/* Visual Table & Chairs Illustration */}
                        <div className="my-3 flex items-center justify-center">
                          <div
                            className={`h-14 w-20 rounded-xl border flex flex-col items-center justify-center text-center ${
                              isOccupied
                                ? "bg-amber-50 border-amber-300"
                                : isBilled
                                ? "bg-purple-50 border-purple-300"
                                : isReserved
                                ? "bg-blue-50 border-blue-300"
                                : "bg-emerald-50 border-emerald-300"
                            }`}
                          >
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-neutral-600">
                              <Users className="h-3 w-3" />
                              <span>{table.seats} Chairs</span>
                            </span>
                            {table.bill > 0 && (
                              <span className="text-xs font-bold text-[#e53e15]">₹{table.bill}</span>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-center text-neutral-500">{table.time}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between rounded-xl bg-white p-3 border border-neutral-200 text-xs">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Vacant (3)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Occupied (3)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Billed (1)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Reserved (1)
                    </span>
                  </div>
                  <span className="font-semibold text-[#e53e15]">
                    Selected: {selectedTableId} • Click to assign guests or view active bill
                  </span>
                </div>
              </div>
            )}

            {/* SCREEN 4: GUEST QR MOBILE ORDERING */}
            {activeScreenTab === "qr" && (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-[#251e1b] text-white p-4 sm:p-8">
                <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-center max-w-4xl mx-auto">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold text-orange-400">
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>Zero App Download • Progressive Web App (PWA)</span>
                    </span>
                    <h3 className="mt-3 font-heading text-2xl sm:text-3xl font-bold">
                      Contactless QR Code Dine-In Ordering
                    </h3>
                    <p className="mt-3 text-sm text-white/70 leading-relaxed">
                      Guests simply aim their phone camera at the tabletop QR sticker. Instant digital menu loads
                      in under 0.8 seconds. Guests can order dishes in rounds, customize spice levels, call the waiter,
                      and pay directly via UPI.
                    </p>
                    <div className="mt-6 space-y-3 text-xs text-white/80">
                      <p className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Instant chair-level ordering — track exactly which guest ordered which dish</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Real-time dish tracking: &quot;Received&quot; → &quot;Cooking&quot; → &quot;Served&quot;</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>One-tap &quot;Request Water&quot; &amp; &quot;Call Captain&quot; buttons</span>
                      </p>
                    </div>
                    <div className="mt-8">
                      <Link
                        href="/order/t-1"
                        target="_blank"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-orange-500 px-6 text-xs font-bold text-white shadow-lg hover:bg-orange-600 transition"
                      >
                        <QrCode className="h-4 w-4" />
                        <span>Open Live QR Ordering Demo in New Tab</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Smartphone Frame Mockup */}
                  <div className="relative mx-auto w-72 rounded-[2.5rem] border-[6px] border-neutral-800 bg-[#161311] p-3 shadow-2xl">
                    {/* Phone Notch */}
                    <div className="mx-auto h-4 w-28 rounded-full bg-neutral-900 mb-2" />

                    {/* Phone Screen Content */}
                    <div className="rounded-[1.8rem] bg-white text-neutral-900 p-3 text-xs overflow-hidden">
                      {/* Mobile Header */}
                      <div className="flex items-center justify-between border-b pb-2">
                        <div>
                          <p className="font-bold text-neutral-900">QRWIK Bistro</p>
                          <p className="text-[10px] text-neutral-500">Table 04 • Indoor</p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                          Live Menu
                        </span>
                      </div>

                      {/* Mobile Dish Cards */}
                      <div className="mt-3 space-y-2">
                        <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-2">
                          <div className="flex justify-between font-semibold">
                            <span>Smoked Paneer Tikka</span>
                            <span className="text-[#e53e15]">₹340</span>
                          </div>
                          <p className="text-[10px] text-neutral-500">Charred peppers, mint relish</p>
                          <div className="mt-2 flex justify-between items-center">
                            <span className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold">
                              <Sparkles className="h-2.5 w-2.5" /> Veg Special
                            </span>
                            <span className="flex items-center gap-0.5 rounded bg-[#e53e15] px-2 py-0.5 text-[10px] font-bold text-white">
                              <Plus className="h-2.5 w-2.5" /> Add
                            </span>
                          </div>
                        </div>

                        <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-2">
                          <div className="flex justify-between font-semibold">
                            <span>Awadhi Dum Biryani</span>
                            <span className="text-[#e53e15]">₹420</span>
                          </div>
                          <p className="text-[10px] text-neutral-500">Saffron rice, slow cooked</p>
                          <div className="mt-2 flex justify-between items-center">
                            <span className="text-[9px] text-red-600 font-bold">Non-Veg</span>
                            <span className="flex items-center gap-0.5 rounded bg-[#e53e15] px-2 py-0.5 text-[10px] font-bold text-white">
                              <Plus className="h-2.5 w-2.5" /> Add
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Floating Mobile Cart Bar */}
                      <div className="mt-4 rounded-xl bg-neutral-900 text-white p-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-white/60">2 Items Added</p>
                          <p className="font-bold text-xs text-orange-400">₹760.00</p>
                        </div>
                        <span className="flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1 text-[10px] font-bold text-white">
                          <span>Place Order</span>
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SCREEN 5: RECIPE INVENTORY & BOM AUTO-DEDUCTION */}
            {activeScreenTab === "inventory" && (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-[#1e2024] text-white p-4 sm:p-6 shadow-inner">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400">
                      <Boxes className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-heading text-base font-semibold">
                        Recipe-Level Inventory &amp; Bill of Materials (BOM)
                      </h3>
                      <p className="text-xs text-white/50">
                        Automatic Raw Material Stock Depletion on every POS order punched
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-300">
                    4 Raw Ingredients Monitored
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { name: "Fresh Paneer", current: "14.5 kg", max: "20 kg", pct: 72, status: "healthy" },
                    { name: "Dairy Heavy Cream", current: "1.8 L", max: "10 L", pct: 18, status: "low" },
                    { name: "Aged Basmati Rice", current: "42 kg", max: "50 kg", pct: 84, status: "healthy" },
                    { name: "Kashmiri Saffron", current: "88 g", max: "100 g", pct: 88, status: "healthy" },
                  ].map((ing) => (
                    <div
                      key={ing.name}
                      className={`rounded-2xl border p-4 ${
                        ing.status === "low"
                          ? "border-red-500/50 bg-red-950/20"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">{ing.name}</span>
                        {ing.status === "low" ? (
                          <span className="flex items-center gap-1 rounded bg-red-500/30 px-1.5 py-0.5 text-[10px] font-bold text-red-300 animate-pulse">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Low Stock</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-semibold">Normal</span>
                        )}
                      </div>
                      <p className="mt-3 text-2xl font-bold font-heading text-white">{ing.current}</p>
                      <p className="text-[11px] text-white/50">Capacity: {ing.max}</p>

                      <div className="mt-3 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            ing.status === "low" ? "bg-red-500" : "bg-cyan-400"
                          }`}
                          style={{ width: `${ing.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recipe Mapping Demonstration Card */}
                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-semibold text-orange-400">
                      Live Recipe Auto-Deduction Engine (How it works in QRWIK-POS)
                    </span>
                    <span className="text-white/50 text-[11px]">Synced with Order #108</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-white/80">
                    <span className="rounded-lg bg-orange-500/20 px-2.5 py-1 text-orange-300 font-semibold">
                      Dish: 1x Awadhi Dum Biryani
                    </span>
                    <span className="text-white/40">auto-deducts ➔</span>
                    <span className="rounded bg-white/10 px-2 py-0.5">250g Basmati Rice</span>
                    <span className="rounded bg-white/10 px-2 py-0.5">220g Chicken / Mutton</span>
                    <span className="rounded bg-white/10 px-2 py-0.5">40g Pure Ghee</span>
                    <span className="rounded bg-white/10 px-2 py-0.5">0.2g Saffron</span>
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>0% Ingredient Shrinkage</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SCREEN 6: SALES & REVENUE COCKPIT */}
            {activeScreenTab === "analytics" && (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-[#1a1715] text-white p-4 sm:p-6 shadow-inner">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="font-heading text-base font-semibold">
                      Executive Sales Cockpit &amp; Daily Business Intelligence
                    </h3>
                    <p className="text-xs text-white/50">
                      Live Revenue Streams • Peak Hour Heatmap • Best Selling Categories
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Live Shift: Dinner Service</span>
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/60">Today&apos;s Gross Sales</p>
                    <p className="mt-2 text-2xl sm:text-3xl font-bold font-heading text-orange-400">
                      ₹1,84,350
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">
                      <TrendingUp className="h-3 w-3" />
                      <span>+18.4% vs last week</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/60">Orders Completed</p>
                    <p className="mt-2 text-2xl sm:text-3xl font-bold font-heading text-white">142</p>
                    <p className="mt-1 text-[11px] text-white/50">Average Prep: 12.4 mins</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/60">Avg Ticket Size (AOV)</p>
                    <p className="mt-2 text-2xl sm:text-3xl font-bold font-heading text-cyan-400">
                      ₹1,298
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">
                      <TrendingUp className="h-3 w-3" />
                      <span>+₹140 higher via QR</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/60">Table Turnover Rate</p>
                    <p className="mt-2 text-2xl sm:text-3xl font-bold font-heading text-emerald-400">
                      4.8x
                    </p>
                    <p className="mt-1 text-[11px] text-white/50">28% faster settlement</p>
                  </div>
                </div>

                {/* Simulated Hourly Bar Graph */}
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      Hourly Sales Velocity (₹)
                    </p>
                    <span className="text-[11px] text-orange-400 font-semibold">Peak: 20:00 - 22:00</span>
                  </div>
                  <div className="flex items-end justify-between gap-2 h-28 pt-4">
                    {[
                      { time: "12 PM", val: 35 },
                      { time: "1 PM", val: 65 },
                      { time: "2 PM", val: 80 },
                      { time: "3 PM", val: 40 },
                      { time: "4 PM", val: 20 },
                      { time: "5 PM", val: 25 },
                      { time: "6 PM", val: 45 },
                      { time: "7 PM", val: 70 },
                      { time: "8 PM", val: 95 },
                      { time: "9 PM", val: 100 },
                      { time: "10 PM", val: 85 },
                      { time: "11 PM", val: 30 },
                    ].map((col) => (
                      <div key={col.time} className="flex-1 flex flex-col items-center gap-1 group">
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-orange-500/40 to-orange-400 transition-all group-hover:bg-orange-300"
                          style={{ height: `${col.val}%` }}
                        />
                        <span className="text-[9px] text-white/40">{col.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 4. CORE MODULES & FEATURES (DEEP DIVE WITH VISUALS)                  */}
      {/* ==================================================================== */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-[#e53e15]">
            Everything Built For High-Pressure Operations
          </span>
          <h2 className="mt-2 font-heading text-3xl sm:text-5xl font-extrabold tracking-tight text-[#191919]">
            Engineered for Fast Turns &amp; Flawless Shifts.
          </h2>
          <p className="mt-4 text-base text-[#706b69]">
            Every screen in QRWIK-POS is purpose-built to eliminate bottlenecks between tables, captain tablets,
            kitchen stations, and the billing desk.
          </p>
        </div>

        {/* FEATURE 1: HIGH-SPEED POS & BILLING */}
        <div className="mt-16 grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">
              <Receipt className="h-4 w-4 text-[#e53e15]" />
              <span>Module 01 • High-Speed POS Terminal</span>
            </div>
            <h3 className="mt-4 font-heading text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900">
              Punch, Modify &amp; Settle in Under 3 Seconds.
            </h3>
            <p className="mt-4 text-base text-[#706b69] leading-relaxed">
              Never keep guests waiting. The QRWIK-POS touch terminal is designed for split-second muscle memory.
              Easily handle running orders, table add-ons, item-level modifiers (&quot;no onion&quot;, &quot;extra spicy&quot;),
              discounts, split bills, and multi-tender checkouts.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs font-semibold text-neutral-800">
              <div className="flex items-center gap-2 rounded-xl bg-white p-3 border border-neutral-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>GST Compliant 80mm &amp; 58mm Thermal KOT</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white p-3 border border-neutral-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Split by Item, Seat or Equal Shares</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white p-3 border border-neutral-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Offline-Resilient Local Sync</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white p-3 border border-neutral-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Multi-Tender (UPI, Cash, Card, Ledger)</span>
              </div>
            </div>
          </div>

          {/* Visual UI Screenshot Preview */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 text-xs">
              <span className="font-bold text-neutral-800">POS Checkout Preview • Split Bill Mode</span>
              <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 font-bold">GST Ready</span>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between p-2 rounded bg-neutral-50 font-medium">
                <span>Guest A (Chair 1 &amp; 2)</span>
                <span className="font-bold text-emerald-700">₹1,120 • UPI QR [Paid]</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-neutral-50 font-medium">
                <span>Guest B (Chair 3)</span>
                <span className="font-bold text-emerald-700">₹540 • Credit Card [Paid]</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-amber-50 font-medium text-amber-900 border border-amber-200">
                <span>Guest C (Chair 4)</span>
                <span className="font-bold text-amber-700">₹480 • Cash [Pending]</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t text-[11px] text-neutral-500 flex justify-between items-center">
              <span>Automatic digital invoice dispatched via WhatsApp</span>
              <span className="text-[#e53e15] font-semibold">Total Table: ₹2,140</span>
            </div>
          </div>
        </div>

        {/* FEATURE 2: KITCHEN DISPLAY SYSTEM (KDS) */}
        <div className="mt-24 grid items-center gap-10 lg:grid-cols-2 lg:grid-flow-dense">
          <div className="lg:col-start-2">
            <div className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              <ChefHat className="h-4 w-4 text-amber-700" />
              <span>Module 02 • Real-Time Kitchen Display (KDS)</span>
            </div>
            <h3 className="mt-4 font-heading text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900">
              Say Goodbye to Lost Paper Tickets &amp; Shouting.
            </h3>
            <p className="mt-4 text-base text-[#706b69] leading-relaxed">
              Route orders dynamically to specific prep stations: Grill, Chinese Wok, Curry &amp; Gravy, Beverage Bar,
              or Dessert Counter. Color-coded timers flash when food is in the danger zone, and food runners get instant
              sound alerts the exact moment a dish is plated.
            </p>
            <div className="mt-6 space-y-2.5 text-xs font-semibold text-neutral-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Station-Specific Filtering — Cheffing team only sees what they cook</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Course Timing Control — Fire Starters first, hold Mains until signaled</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Item-level 86ing — Mark dishes sold out right from the kitchen display</span>
              </div>
            </div>
          </div>

          {/* Visual KDS UI Mockup */}
          <div className="lg:col-start-1 rounded-3xl border border-neutral-800 bg-[#16191f] p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs">
              <span className="font-bold text-orange-400">Station: Tandoor &amp; Starters</span>
              <span className="text-white/50">Ticket #112 • 08m 12s Elapsed</span>
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-white/5 p-2.5">
                <span className="font-semibold text-white">2x Tandoori Malai Chaap</span>
                <span className="text-emerald-400 font-bold">READY</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/5 p-2.5">
                <span className="font-semibold text-white">1x Paneer Tikka (Extra Chutney)</span>
                <span className="text-amber-400 font-bold">IN TANDOOR</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-center text-xs font-bold text-white"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Pass to Waiter Chime</span>
              </button>
            </div>
          </div>
        </div>

        {/* FEATURE 3: CHAIR-LEVEL QR SELF-ORDERING */}
        <div className="mt-24 grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              <QrCode className="h-4 w-4 text-emerald-700" />
              <span>Module 03 • Contactless QR Dine-In Ordering</span>
            </div>
            <h3 className="mt-4 font-heading text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900">
              Empower Guests to Order &amp; Pay from Their Phones.
            </h3>
            <p className="mt-4 text-base text-[#706b69] leading-relaxed">
              Guests don&apos;t wait for a busy waiter during peak rush. They scan the table QR code, browse high-res
              dish photos, filter for vegetarian/allergens, customize their order, and punch items directly into the KDS.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs font-semibold text-neutral-800">
              <div className="rounded-xl bg-white p-3 border border-neutral-200">
                <p className="text-lg font-bold text-[#e53e15]">+22%</p>
                <p className="text-neutral-600">Higher Average Order Value</p>
              </div>
              <div className="rounded-xl bg-white p-3 border border-neutral-200">
                <p className="text-lg font-bold text-[#e53e15]">14 Mins</p>
                <p className="text-neutral-600">Saved Per Table Turnaround</p>
              </div>
            </div>
          </div>

          {/* Visual QR Menu Preview Card */}
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="font-bold text-neutral-800">Guest Smartphone Live View</span>
              </div>
              <span className="text-xs text-neutral-500">Table 04 • QR Scan Active</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-neutral-100 bg-[#fff5f2] p-3 text-xs">
                <div className="h-20 rounded-xl bg-gradient-to-tr from-orange-400 to-red-400 flex items-center justify-center text-white font-bold">
                  Awadhi Biryani
                </div>
                <p className="mt-2 font-bold text-neutral-900">Awadhi Dum Biryani</p>
                <p className="text-[11px] text-neutral-500">₹420 • Saffron Rice</p>
                <button
                  type="button"
                  className="mt-2 w-full flex items-center justify-center gap-1 rounded-lg bg-[#e53e15] py-1 font-bold text-white text-[10px]"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add to Table</span>
                </button>
              </div>
              <div className="rounded-2xl border border-neutral-100 bg-[#f0fbf7] p-3 text-xs">
                <div className="h-20 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold">
                  Paneer Tikka
                </div>
                <p className="mt-2 font-bold text-neutral-900">Smoked Paneer Tikka</p>
                <p className="text-[11px] text-neutral-500">₹340 • Mint Chutney</p>
                <button
                  type="button"
                  className="mt-2 w-full flex items-center justify-center gap-1 rounded-lg bg-[#e53e15] py-1 font-bold text-white text-[10px]"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add to Table</span>
                </button>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-neutral-900 p-3 text-white text-xs flex justify-between items-center">
              <span>Cart: 2 items • Total ₹760</span>
              <span className="flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1 font-bold text-[11px]">
                <CreditCard className="h-3 w-3" />
                <span>Pay UPI Now</span>
              </span>
            </div>
          </div>
        </div>

        {/* FEATURE 4: RECIPE-LEVEL INVENTORY BOM */}
        <div className="mt-24 grid items-center gap-10 lg:grid-cols-2 lg:grid-flow-dense">
          <div className="lg:col-start-2">
            <div className="inline-flex items-center gap-2 rounded-xl bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
              <Boxes className="h-4 w-4 text-purple-700" />
              <span>Module 04 • Recipe BOM &amp; Stock Depletion</span>
            </div>
            <h3 className="mt-4 font-heading text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900">
              Track Raw Food Cost Down to the Last Gram.
            </h3>
            <p className="mt-4 text-base text-[#706b69] leading-relaxed">
              Stop inventory pilferage and stock-outs. In QRWIK-POS, every menu item is linked to a Bill of Materials
              (BOM). When a pizza or curry is punched, the exact grams of mozzarella, paneer, and oil are deducted
              in real time.
            </p>
            <div className="mt-6 space-y-2.5 text-xs font-semibold text-neutral-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Automatic Low-Stock Warnings &amp; Automated Purchase Orders (PO)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Daily Wastage Logging with Reason Codes (Spill, Expiry, Overcooked)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Exact Food Cost % and Profit Margin per Dish</span>
              </div>
            </div>
          </div>

          {/* Visual BOM Screen Preview */}
          <div className="lg:col-start-1 rounded-3xl border border-neutral-200 bg-white p-5 shadow-xl text-neutral-800">
            <div className="flex items-center justify-between border-b pb-3 text-xs">
              <span className="font-bold">Recipe Breakdown • Smoked Butter Chicken</span>
              <span className="font-semibold text-purple-700">Cost: ₹118 / Portion</span>
            </div>
            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2 rounded bg-neutral-50">
                <span>Boneless Chicken (250g)</span>
                <span className="text-neutral-500">₹62.50</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-neutral-50">
                <span>Amul Butter (50g)</span>
                <span className="text-neutral-500">₹26.00</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-neutral-50">
                <span>Dairy Cream (30ml)</span>
                <span className="text-neutral-500">₹14.20</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-neutral-50">
                <span>Tomato Gravy &amp; Spices</span>
                <span className="text-neutral-500">₹15.30</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t flex justify-between items-center text-xs font-bold">
              <span>Selling Price: ₹440</span>
              <span className="text-emerald-600">Gross Margin: 73.1% Profit</span>
            </div>
          </div>
        </div>

        {/* FEATURE 5: CRM & AUTOMATED WHATSAPP MARKETING */}
        <div className="mt-24 grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
              <MessageSquare className="h-4 w-4 text-blue-700" />
              <span>Module 05 • WhatsApp Receipts &amp; Guest CRM</span>
            </div>
            <h3 className="mt-4 font-heading text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900">
              Turn One-Time Diners into Lifelong Regulars.
            </h3>
            <p className="mt-4 text-base text-[#706b69] leading-relaxed">
              Ditch expensive thermal paper rolls! Automatically deliver beautiful digital bills directly to the
              customer&apos;s WhatsApp with your branding, a Google Review request, and a personalized 15% discount
              for their next visit.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs font-semibold text-neutral-800">
              <div className="rounded-xl bg-white p-3 border border-neutral-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mb-1" />
                <span>Auto-capture phone numbers legally with OTP or bill sharing</span>
              </div>
              <div className="rounded-xl bg-white p-3 border border-neutral-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mb-1" />
                <span>Automated birthday &amp; anniversary promotional broadcasts</span>
              </div>
            </div>
          </div>

          {/* Visual WhatsApp Chat Card Preview */}
          <div className="rounded-3xl border border-neutral-200 bg-[#efeae2] p-5 shadow-xl text-neutral-800">
            <div className="flex items-center gap-3 border-b border-neutral-300 pb-3">
              <div className="h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                Q
              </div>
              <div>
                <p className="text-xs font-bold text-neutral-900">QRWIK Restaurant Official</p>
                <p className="text-[10px] text-emerald-700 font-semibold">Verified WhatsApp Business Account</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-white p-3.5 shadow-sm text-xs space-y-2 max-w-sm">
              <p className="font-semibold text-neutral-900">
                Hello Rahul! Thank you for dining with us at QRWIK Bistro (Table 04).
              </p>
              <div className="rounded-lg bg-neutral-50 p-2.5 border border-neutral-200 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span>Bill #2049</span>
                  <span className="font-bold">Total: ₹1,628.00</span>
                </div>
                <div className="flex justify-between text-neutral-500">
                  <span>Payment: UPI Successful</span>
                  <span>GSTIN: 07AAAAA0000A1Z5</span>
                </div>
              </div>
              <p className="text-[11px] text-neutral-600">
                Loved the food? Leave us a quick 5-star review and get <strong>15% OFF</strong> on your next visit!
              </p>
              <div className="pt-2 border-t flex gap-2">
                <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                  Download PDF Invoice
                </span>
                <span className="rounded bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">
                  Claim 15% Reward
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 5. 24+ COMPREHENSIVE FEATURES GRID                                   */}
      {/* ==================================================================== */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 border-t border-neutral-200/80">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-[#e53e15]">
            Full Feature Matrix
          </span>
          <h2 className="mt-2 font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
            Every Tool You Need to Scale Your Restaurant.
          </h2>
          <p className="mt-3 text-sm text-[#706b69]">
            From quick-service cafes to multi-floor fine-dining bars and multi-chain cloud kitchens.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Receipt,
              title: "Rapid POS Punching",
              desc: "Instant search, barcode scanner support, and touch categories to punch orders under 0.4 seconds.",
            },
            {
              icon: LayoutGrid,
              title: "Chair-Level Seating",
              desc: "Visual multi-floor plan with seat-by-seat order tagging, chair holds, and merge/split tables.",
            },
            {
              icon: ChefHat,
              title: "Station-Wise KDS",
              desc: "Route Grill, Wok, and Bar tickets independently with color countdown timers and audio chime alerts.",
            },
            {
              icon: QrCode,
              title: "Dynamic QR Ordering",
              desc: "Contactless PWA self-ordering for dine-in guests without downloading any app or signing up.",
            },
            {
              icon: Split,
              title: "GST Split Billing",
              desc: "Equal split, chair split, item split, and multiple tenders (UPI, Cash, Card, Ledger, Loyalty).",
            },
            {
              icon: Boxes,
              title: "Recipe-Level BOM",
              desc: "Auto-deduct raw materials per serving, low stock alerts, and production batch planning.",
            },
            {
              icon: MessageCircle,
              title: "WhatsApp Marketing",
              desc: "Deliver digital PDF invoices, collect Google reviews, and broadcast automated birthday coupons.",
            },
            {
              icon: BarChart3,
              title: "Sales & P&L Analytics",
              desc: "Live gross sales, hourly heatmaps, dish contribution margins, waiter performance, and tax reports.",
            },
            {
              icon: ShieldCheck,
              title: "Role-Based RBAC",
              desc: "Granular permissions for Cashier, Waiter, Kitchen Lead, Store Manager, and Multi-Outlet Owner.",
            },
            {
              icon: Clock,
              title: "Shift & Float Balances",
              desc: "Track cash drawer opening float, midday drops, and end-of-shift cash drawer reconciliation.",
            },
            {
              icon: UtensilsCrossed,
              title: "Course-Wise Serving",
              desc: "Tag tickets with Starters, Mains, and Desserts. Fire courses sequentially with one click.",
            },
            {
              icon: Sparkles,
              title: "Loyalty Tiers & Rewards",
              desc: "Built-in cashback and point accrual system to reward frequent guests and increase return visits.",
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-neutral-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:border-[#e53e15]/40 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e53e15]/10 text-[#e53e15]">
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="mt-4 font-heading text-base font-bold text-neutral-900">{item.title}</h4>
                <p className="mt-2 text-xs leading-relaxed text-[#706b69]">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 6. ORDER LIFECYCLE: FROM SCAN TO BILL                                */}
      {/* ==================================================================== */}
      <section id="flow" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 border-t border-neutral-200/80 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-[#e53e15]">
            Seamless Operational Harmony
          </span>
          <h2 className="mt-2 font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
            How An Order Moves Through QRWIK-POS.
          </h2>
          <p className="mt-3 text-sm text-[#706b69]">
            A single, continuous real-time data stream connects every station with zero communication delays.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            {
              step: "01",
              icon: QrCode,
              title: "Scan or Punch",
              desc: "Guest scans tabletop QR or Captain taps POS terminal. Ticket generated in under 0.4s.",
              badge: "Table / Captain",
            },
            {
              step: "02",
              icon: Flame,
              title: "Kitchen Routing",
              desc: "Order auto-splits across Grill, Curry & Bar KDS displays with color-coded timers.",
              badge: "Kitchen Display",
            },
            {
              step: "03",
              icon: Package,
              title: "Stock Depletion",
              desc: "Exact grams of paneer, cream, and meat are deducted automatically from inventory.",
              badge: "Inventory BOM",
            },
            {
              step: "04",
              icon: ChefHat,
              title: "Plated & Served",
              desc: "Chef bumps ticket; captain gets instant alert on smartwatch or screen to pick up food.",
              badge: "Service Staff",
            },
            {
              step: "05",
              icon: Wallet,
              title: "Split & Settle",
              desc: "Cashier settles via UPI QR, card, or cash. WhatsApp digital invoice sent to customer.",
              badge: "Billing Desk",
            },
          ].map((s) => {
            const StepIcon = s.icon;
            return (
              <div
                key={s.step}
                className="relative rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-neutral-800"
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading text-2xl font-black text-[#e53e15]">{s.step}</span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                    {s.badge}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <StepIcon className="h-4 w-4 text-[#e53e15]" />
                  <h4 className="font-heading text-sm font-bold text-neutral-900">{s.title}</h4>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#706b69]">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 7. INTERACTIVE ROI & SAVINGS CALCULATOR                             */}
      {/* ==================================================================== */}
      <section id="calculator" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 border-t border-neutral-200/80 scroll-mt-20">
        <div className="rounded-3xl border border-white/80 bg-gradient-to-br from-white via-white/80 to-[#ffeae4] p-6 sm:p-12 shadow-2xl backdrop-blur-2xl">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#e53e15]">
                Interactive Efficiency Calculator
              </span>
              <h2 className="mt-2 font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
                Calculate Your Restaurant&apos;s Return on Investment.
              </h2>
              <p className="mt-4 text-sm text-[#706b69] leading-relaxed">
                By speeding up order taking, eliminating order mistakes in the kitchen, and giving guests the power
                to order rounds via QR code, QRWIK-POS dramatically accelerates table turns.
              </p>

              <div className="mt-6">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
                  Select Your Restaurant Size (Total Tables):
                </label>
                <div className="mt-3 flex gap-2">
                  {[10, 25, 50, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCalcTables(num)}
                      className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
                        calcTables === num
                          ? "bg-[#e53e15] text-white shadow-md"
                          : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      {num} Tables
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-center">
                <p className="text-xs text-neutral-500 font-medium">Extra Table Turns / Day</p>
                <p className="mt-2 font-heading text-3xl font-extrabold text-[#e53e15]">
                  +{(calcTables * 0.8).toFixed(0)} Turns
                </p>
                <p className="mt-1 text-[11px] text-emerald-600 font-semibold">28% faster dining turnaround</p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-center">
                <p className="text-xs text-neutral-500 font-medium">Staff Hours Saved / Month</p>
                <p className="mt-2 font-heading text-3xl font-extrabold text-neutral-900">
                  {calcTables * 6} Hours
                </p>
                <p className="mt-1 text-[11px] text-emerald-600 font-semibold">Eliminates duplicate trips</p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-center">
                <p className="text-xs text-neutral-500 font-medium">Food Cost Leakage Reduced</p>
                <p className="mt-2 font-heading text-3xl font-extrabold text-purple-700">
                  -18.5%
                </p>
                <p className="mt-1 text-[11px] text-emerald-600 font-semibold">Via Recipe Auto-BOM tracking</p>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm text-center">
                <p className="text-xs text-neutral-500 font-medium">Est. Extra Revenue / Month</p>
                <p className="mt-2 font-heading text-3xl font-extrabold text-emerald-600">
                  +₹{(calcTables * 4200).toLocaleString("en-IN")}
                </p>
                <p className="mt-1 text-[11px] text-neutral-500">Based on ₹850 avg ticket size</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 8. HARDWARE & DEVICE COMPATIBILITY                                   */}
      {/* ==================================================================== */}
      <section id="hardware" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 border-t border-neutral-200/80 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-[#e53e15]">
            Hardware Agnostic Architecture
          </span>
          <h2 className="mt-2 font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
            Works with the Hardware You Already Own.
          </h2>
          <p className="mt-3 text-sm text-[#706b69]">
            No expensive proprietary locked-in hardware. Run QRWIK-POS on any tablet, PC, touch terminal, or phone.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm flex flex-col items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#e53e15] mb-2">
              <Printer className="h-7 w-7" />
            </div>
            <h4 className="mt-2 font-heading text-sm font-bold text-neutral-900">Thermal Receipt Printers</h4>
            <p className="mt-1 text-xs text-neutral-500">ESC/POS 80mm &amp; 58mm via USB, LAN, Wi-Fi &amp; Bluetooth</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm flex flex-col items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#e53e15] mb-2">
              <Monitor className="h-7 w-7" />
            </div>
            <h4 className="mt-2 font-heading text-sm font-bold text-neutral-900">Touch POS &amp; Desktops</h4>
            <p className="mt-1 text-xs text-neutral-500">Windows POS, Mac, Linux, and Sunmi all-in-one touchscreens</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm flex flex-col items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#e53e15] mb-2">
              <Tablet className="h-7 w-7" />
            </div>
            <h4 className="mt-2 font-heading text-sm font-bold text-neutral-900">iPads &amp; Android Tablets</h4>
            <p className="mt-1 text-xs text-neutral-500">Handheld waiter terminals for table-side order taking</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm flex flex-col items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#e53e15] mb-2">
              <Tv className="h-7 w-7" />
            </div>
            <h4 className="mt-2 font-heading text-sm font-bold text-neutral-900">Kitchen Smart TVs</h4>
            <p className="mt-1 text-xs text-neutral-500">Mount any inexpensive HDMI Android TV in the kitchen for KDS</p>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 9. HEAD-TO-HEAD COMPARISON                                           */}
      {/* ==================================================================== */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 border-t border-neutral-200/80">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-[#e53e15]">
            The Competitive Edge
          </span>
          <h2 className="mt-2 font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
            Why Restaurants Are Switching to QRWIK-POS.
          </h2>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-neutral-200 bg-white shadow-xl">
          <table className="w-full text-left text-xs text-neutral-800">
            <thead className="border-b bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-600">
              <tr>
                <th className="p-4 sm:p-5">Capability / Feature</th>
                <th className="p-4 sm:p-5 text-[#e53e15] font-extrabold bg-[#e53e15]/5">QRWIK-POS</th>
                <th className="p-4 sm:p-5">Traditional Legacy POS</th>
                <th className="p-4 sm:p-5">Aggregator Portals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              <tr>
                <td className="p-4 sm:p-5 font-semibold">Contactless Table QR Self-Ordering (PWA)</td>
                <td className="p-4 sm:p-5 font-bold text-emerald-600 bg-[#e53e15]/5">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Included (No App Needed)</span>
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <X className="h-4 w-4 text-neutral-400" />
                    <span>Not Supported</span>
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <X className="h-4 w-4 text-neutral-400" />
                    <span>Extra Commissions</span>
                  </span>
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-semibold">Real-Time Kitchen KDS with Station Routing</td>
                <td className="p-4 sm:p-5 font-bold text-emerald-600 bg-[#e53e15]/5">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Multi-Station Live Routing</span>
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <X className="h-4 w-4 text-neutral-400" />
                    <span>Expensive Add-on Hardware</span>
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <X className="h-4 w-4 text-neutral-400" />
                    <span>None</span>
                  </span>
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-semibold">Recipe-Level Auto-Inventory Depletion (BOM)</td>
                <td className="p-4 sm:p-5 font-bold text-emerald-600 bg-[#e53e15]/5">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Gram-Level Live Tracking</span>
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <X className="h-4 w-4 text-neutral-400" />
                    <span>Manual End-of-Day Counts</span>
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <X className="h-4 w-4 text-neutral-400" />
                    <span>None</span>
                  </span>
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-semibold">Automated WhatsApp Receipts &amp; Loyalty</td>
                <td className="p-4 sm:p-5 font-bold text-emerald-600 bg-[#e53e15]/5">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Direct API Integration</span>
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <X className="h-4 w-4 text-neutral-400" />
                    <span>Paper Thermal Only</span>
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <X className="h-4 w-4 text-neutral-400" />
                    <span>Guest Data Withheld</span>
                  </span>
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-semibold">Hardware Freedom (Use Any Tablet / PC)</td>
                <td className="p-4 sm:p-5 font-bold text-emerald-600 bg-[#e53e15]/5">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>100% Device Agnostic</span>
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <X className="h-4 w-4 text-neutral-400" />
                    <span>Locked to Proprietary Terminals</span>
                  </span>
                </td>
                <td className="p-4 sm:p-5 text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <X className="h-4 w-4 text-neutral-400" />
                    <span>Restricted</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 10. FREQUENTLY ASKED QUESTIONS (FAQ) ACCORDION                       */}
      {/* ==================================================================== */}
      <section id="faq" className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8 border-t border-neutral-200/80 scroll-mt-20">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#e53e15]">
            Frequently Asked Questions
          </span>
          <h2 className="mt-2 font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
            Got Questions? We Have Answers.
          </h2>
        </div>

        <div className="space-y-3">
          {[
            {
              q: "Can QRWIK-POS operate offline if our restaurant internet goes down?",
              a: "Yes! QRWIK-POS features offline-resilient architecture. Your staff can punch orders, print KOTs to thermal printers on the local LAN, and calculate bills seamlessly without an active internet connection. As soon as connectivity restores, all transactions sync to the cloud automatically.",
            },
            {
              q: "Do dining guests need to download an app to order via QR code?",
              a: "No! QRWIK-POS uses lightweight Progressive Web App (PWA) technology. When a guest points their smartphone camera at the table QR code, the digital menu opens instantly in their native mobile browser in under 0.8 seconds. No sign-up, no downloads, zero friction.",
            },
            {
              q: "Does QRWIK-POS support our existing thermal printers and cash drawers?",
              a: "Yes! QRWIK-POS works with standard ESC/POS 80mm and 58mm thermal printers (Epson, TVS, Star Micronics, Posiflex) connecting over USB, Ethernet LAN, Wi-Fi, or Bluetooth. It also sends standard pulse signals to kick open cash drawers upon settlement.",
            },
            {
              q: "How does the recipe-level raw material auto-deduction work?",
              a: "When you add dishes like 'Butter Chicken' or 'Cold Brew' to your menu, you can configure their Bill of Materials (BOM) with ingredient portions (e.g. 250g Chicken, 40g Butter). Each time that dish is punched on the POS or ordered via QR, the exact raw materials are subtracted from inventory instantly.",
            },
            {
              q: "Can I manage multiple outlets or chains from a single login?",
              a: "Yes. QRWIK-POS supports multi-outlet enterprise management. Owners can monitor live sales, switch between branch locations, standardize menu pricing, and compare store throughput metrics from one consolidated dashboard.",
            },
          ].map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-neutral-200/90 bg-white/80 p-5 shadow-sm backdrop-blur-xl transition"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="flex w-full items-center justify-between text-left text-sm font-bold text-neutral-900"
              >
                <span>{faq.q}</span>
                <span className="text-[#e53e15]">
                  {openFaq === idx ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </span>
              </button>
              {openFaq === idx && (
                <p className="mt-3 text-xs leading-relaxed text-[#706b69] border-t border-neutral-100 pt-3">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 11. HIGH IMPACT CALL TO ACTION BANNER                                 */}
      {/* ==================================================================== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-[#1a1412] px-6 py-16 text-white shadow-2xl sm:px-12 sm:py-20 lg:flex lg:items-center lg:justify-between lg:gap-12">
          {/* Ambient glow behind CTA */}
          <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-[#e53e15]/25 blur-3xl" />
          <div className="pointer-events-none absolute left-0 bottom-0 h-96 w-96 rounded-full bg-[#1f7a8c]/20 blur-3xl" />

          <div className="relative max-w-2xl">
            <span className="flex items-center gap-1.5 w-fit rounded-full bg-orange-500/20 px-3.5 py-1 text-xs font-bold text-orange-400">
              <Zap className="h-3.5 w-3.5" />
              <span>Upgrade Your Restaurant Operating System</span>
            </span>
            <h2 className="mt-4 font-heading text-3xl sm:text-5xl font-extrabold tracking-tight">
              Ready to Experience QRWIK-POS in Real Time?
            </h2>
            <p className="mt-4 text-sm sm:text-base text-white/70 leading-relaxed">
              Launch the live interactive POS terminal right now or simulate table-side QR self-ordering
              with zero setup.
            </p>
          </div>

          <div className="relative mt-8 flex flex-col sm:flex-row gap-3 lg:mt-0 shrink-0">
            <Link
              href="/admin"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#e53e15] to-[#ff4b24] px-8 text-sm font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl"
            >
              <Monitor className="h-4 w-4" />
              <span>Enter POS Workspace</span>
            </Link>
            <Link
              href="/order/t-1"
              target="_blank"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/20 hover:-translate-y-0.5"
            >
              <QrCode className="h-4 w-4" />
              <span>Try Guest QR Demo</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 12. COMPREHENSIVE FOOTER                                             */}
      {/* ==================================================================== */}
      <footer className="border-t border-neutral-200/80 bg-white/60 py-12 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {/* Brand column */}
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e53e15] text-white">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <span className="font-heading text-xl font-bold tracking-tight text-neutral-900">
                  QRWIK<span className="text-[#e53e15]">-POS</span>
                </span>
              </Link>
              <p className="mt-3 text-xs text-[#706b69] max-w-sm leading-relaxed">
                The next-generation restaurant operating system unifying high-speed touch billing,
                chair-level QR self-ordering, kitchen KDS station routing, and recipe inventory.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-neutral-600">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                <span>All Systems Operational • 99.99% Uptime</span>
              </div>
            </div>

            {/* Links column: Operations */}
            <div>
              <p className="font-bold text-xs uppercase tracking-wider text-neutral-900">Operations</p>
              <ul className="mt-3 space-y-2 text-xs text-[#706b69]">
                <li>
                  <Link href="/admin/orders" className="hover:text-[#e53e15]">
                    POS Billing Terminal
                  </Link>
                </li>
                <li>
                  <Link href="/admin/tables" className="hover:text-[#e53e15]">
                    Floor &amp; Table Map
                  </Link>
                </li>
                <li>
                  <Link href="/admin/kitchen" className="hover:text-[#e53e15]">
                    Kitchen Display (KDS)
                  </Link>
                </li>
                <li>
                  <Link href="/order/t-1" target="_blank" className="hover:text-[#e53e15]">
                    Guest QR Dine-in PWA
                  </Link>
                </li>
              </ul>
            </div>

            {/* Links column: Management */}
            <div>
              <p className="font-bold text-xs uppercase tracking-wider text-neutral-900">Management</p>
              <ul className="mt-3 space-y-2 text-xs text-[#706b69]">
                <li>
                  <Link href="/admin/inventory" className="hover:text-[#e53e15]">
                    Recipe Inventory (BOM)
                  </Link>
                </li>
                <li>
                  <Link href="/admin/billing" className="hover:text-[#e53e15]">
                    Billing &amp; Tax Invoices
                  </Link>
                </li>
                <li>
                  <Link href="/admin/reports" className="hover:text-[#e53e15]">
                    Sales Analytics &amp; Reports
                  </Link>
                </li>
                <li>
                  <Link href="/admin/staff" className="hover:text-[#e53e15]">
                    Staff Shifts &amp; RBAC
                  </Link>
                </li>
              </ul>
            </div>

            {/* Links column: System */}
            <div>
              <p className="font-bold text-xs uppercase tracking-wider text-neutral-900">Access</p>
              <ul className="mt-3 space-y-2 text-xs text-[#706b69]">
                <li>
                  <Link href="/admin" className="hover:text-[#e53e15]">
                    Admin Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-[#e53e15]">
                    Staff Login
                  </Link>
                </li>
                <li>
                  <a href="#screens" className="hover:text-[#e53e15]">
                    Live Mockups
                  </a>
                </li>
                <li>
                  <a href="#calculator" className="hover:text-[#e53e15]">
                    ROI Calculator
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#706b69]">
            <p>© {new Date().getFullYear()} QRWIK-POS. All rights reserved. High-Performance Restaurant OS.</p>
            <p className="flex items-center gap-2">
              <span>GST Compliant</span>
              <span>•</span>
              <span>ESC/POS Thermal Ready</span>
              <span>•</span>
              <span>Offline First</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}