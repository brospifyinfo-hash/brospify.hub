"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  Shield,
  Clock,
  Star,
  Package,
  Palette,
  Type,
  Check,
  CreditCard,
  Lock,
  ChevronRight,
  Minus,
  Plus,
  Truck,
  RotateCcw,
  X,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useI18n } from "@/lib/i18n";

// ─── Toggle Component ────────────────────────────────────
function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {desc && <p className="text-[11px] text-zinc-500 mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!on)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
          on ? "bg-[#95BF47]" : "bg-zinc-700"
        }`}
      >
        <motion.div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
          animate={{ left: on ? 22 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

// ─── Color Picker Field ──────────────────────────────────
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg border border-zinc-700 cursor-pointer bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-glass flex-1 text-xs font-mono"
        />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────
export default function CheckoutCustomizerPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);

  // Trust badges
  const [paypal, setPaypal] = useState(true);
  const [klarna, setKlarna] = useState(true);
  const [visa, setVisa] = useState(true);
  const [guarantee, setGuarantee] = useState(true);
  const [secureCheckout, setSecureCheckout] = useState(true);

  // Urgency & Conversion
  const [cartTimer, setCartTimer] = useState(false);
  const [stickyAtc, setStickyAtc] = useState(true);
  const [crossSell, setCrossSell] = useState(false);

  // Design
  const [accentColor, setAccentColor] = useState("#95BF47");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [font, setFont] = useState("Inter");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.isLoggedIn) { router.push("/"); return; }
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const de = t.nav.home !== "Home";

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-purple-400" />
            Checkout Customizer
          </h1>
          <p className="text-zinc-400">
            {de ? "Passe Trust-Badges, Urgency-Elemente und das Design deines Checkouts an." : "Customize trust badges, urgency elements and checkout design."}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* ═══════ LEFT: Settings ═══════ */}
          <div className="lg:col-span-2 space-y-5">

            {/* Trust Badges */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="glass-strong rounded-2xl border border-white/10 p-5 backdrop-blur-xl">
              <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-[#95BF47]" />
                Trust Badges
              </h3>
              <div className="divide-y divide-white/5">
                <Toggle on={paypal} onChange={setPaypal} label="PayPal" desc={de ? "Zahlungssymbol anzeigen" : "Show payment icon"} />
                <Toggle on={klarna} onChange={setKlarna} label="Klarna" desc={de ? "Ratenzahlung-Badge" : "Installment badge"} />
                <Toggle on={visa} onChange={setVisa} label="Visa / Mastercard" desc={de ? "Kreditkarten-Symbole" : "Credit card icons"} />
                <Toggle on={guarantee} onChange={setGuarantee} label={de ? "30 Tage Geld-zur\u00FCck" : "30 Day Money-Back"} desc={de ? "Garantie-Siegel anzeigen" : "Show guarantee seal"} />
                <Toggle on={secureCheckout} onChange={setSecureCheckout} label={de ? "Sicherer Checkout" : "Secure Checkout"} desc="SSL Lock Badge" />
              </div>
            </motion.div>

            {/* Urgency & Conversion */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="glass-strong rounded-2xl border border-white/10 p-5 backdrop-blur-xl">
              <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-amber-400" />
                Urgency & Conversion
              </h3>
              <div className="divide-y divide-white/5">
                <Toggle on={cartTimer} onChange={setCartTimer} label="Cart Timer" desc={de ? "Countdown im Warenkorb (15:00)" : "Countdown in cart (15:00)"} />
                <Toggle on={stickyAtc} onChange={setStickyAtc} label="Sticky Add-to-Cart" desc={de ? "Feste Kaufleiste am unteren Rand" : "Fixed buy bar at the bottom"} />
                <Toggle on={crossSell} onChange={setCrossSell} label={de ? "Kunden kauften auch" : "Customers also bought"} desc="Cross-Sell Section" />
              </div>
            </motion.div>

            {/* Design */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="glass-strong rounded-2xl border border-white/10 p-5 backdrop-blur-xl space-y-4">
              <h3 className="font-bold text-sm flex items-center gap-2 mb-1">
                <Palette className="w-4 h-4 text-purple-400" />
                {de ? "Design-Anpassungen" : "Design Customization"}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label={de ? "Akzentfarbe" : "Accent Color"} value={accentColor} onChange={setAccentColor} />
                <ColorField label={de ? "Hintergrund" : "Background"} value={bgColor} onChange={setBgColor} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
                  <Type className="w-3 h-3" />
                  Font
                </label>
                <select
                  value={font}
                  onChange={(e) => setFont(e.target.value)}
                  className="input-glass w-full"
                >
                  <option value="Inter">Inter</option>
                  <option value="Poppins">Poppins</option>
                  <option value="DM Sans">DM Sans</option>
                  <option value="Manrope">Manrope</option>
                  <option value="Space Grotesk">Space Grotesk</option>
                </select>
              </div>
            </motion.div>
          </div>

          {/* ═══════ RIGHT: Live Preview ═══════ */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-3"
          >
            <div className="sticky top-24">
              <div className="glass-strong rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl">
                {/* Preview Header */}
                <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                  <span className="text-xs text-zinc-500 ml-2">checkout-preview.myshopify.com</span>
                </div>

                {/* Checkout Mockup */}
                <div
                  className="p-6 space-y-5 transition-all duration-300"
                  style={{ backgroundColor: bgColor, fontFamily: font, color: bgColor === "#ffffff" ? "#111" : "#fff" }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: bgColor === "#ffffff" ? "#e5e7eb" : "rgba(255,255,255,0.1)" }}>
                    <h3 className="text-lg font-bold" style={{ fontFamily: font }}>Checkout</h3>
                    <Lock className="w-4 h-4" style={{ color: accentColor }} />
                  </div>

                  {/* Cart Timer */}
                  {cartTimer && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
                      style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                    >
                      <Clock className="w-4 h-4" />
                      {de ? "Reserviert f\u00FCr dich:" : "Reserved for you:"} <span className="font-bold">14:59</span>
                    </motion.div>
                  )}

                  {/* Product */}
                  <div className="flex items-center gap-4 p-4 rounded-xl" style={{ backgroundColor: bgColor === "#ffffff" ? "#f9fafb" : "rgba(255,255,255,0.05)" }}>
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-zinc-200 to-zinc-300 flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">Premium Product</p>
                      <p className="text-xs opacity-60 mt-0.5">Variant: Default</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: bgColor === "#ffffff" ? "#e5e7eb" : "rgba(255,255,255,0.1)" }}>
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-bold w-4 text-center">1</span>
                      <button className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: bgColor === "#ffffff" ? "#e5e7eb" : "rgba(255,255,255,0.1)" }}>
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="font-bold text-sm shrink-0">49,99 &euro;</p>
                  </div>

                  {/* Cross-Sell */}
                  {crossSell && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-4 rounded-xl space-y-3" style={{ backgroundColor: bgColor === "#ffffff" ? "#f0fdf4" : "rgba(149,191,71,0.05)" }}
                    >
                      <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: accentColor }}>
                        <Star className="w-3.5 h-3.5" />
                        {de ? "Kunden kauften auch" : "Customers also bought"}
                      </p>
                      <div className="flex gap-3">
                        {[1, 2].map((i) => (
                          <div key={i} className="flex items-center gap-2 flex-1 p-2 rounded-lg" style={{ backgroundColor: bgColor === "#ffffff" ? "white" : "rgba(255,255,255,0.05)", border: "1px solid", borderColor: bgColor === "#ffffff" ? "#e5e7eb" : "rgba(255,255,255,0.1)" }}>
                            <div className="w-10 h-10 rounded bg-zinc-200 shrink-0" />
                            <div>
                              <p className="text-[10px] font-semibold">Add-on {i}</p>
                              <p className="text-[10px] opacity-60">{(9.99 * i).toFixed(2)} &euro;</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Trust Badges Row */}
                  <div className="flex flex-wrap gap-2">
                    {paypal && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ backgroundColor: bgColor === "#ffffff" ? "#f3f4f6" : "rgba(255,255,255,0.08)", color: bgColor === "#ffffff" ? "#374151" : "#d4d4d8" }}>
                        <CreditCard className="w-3 h-3" /> PayPal
                      </div>
                    )}
                    {klarna && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ backgroundColor: bgColor === "#ffffff" ? "#fdf2f8" : "rgba(236,72,153,0.08)", color: "#ec4899" }}>
                        <CreditCard className="w-3 h-3" /> Klarna
                      </div>
                    )}
                    {visa && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ backgroundColor: bgColor === "#ffffff" ? "#eff6ff" : "rgba(59,130,246,0.08)", color: "#3b82f6" }}>
                        <CreditCard className="w-3 h-3" /> Visa / MC
                      </div>
                    )}
                    {guarantee && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ backgroundColor: bgColor === "#ffffff" ? "#f0fdf4" : "rgba(34,197,94,0.08)", color: "#22c55e" }}>
                        <RotateCcw className="w-3 h-3" /> {de ? "30 Tage" : "30 Days"}
                      </div>
                    )}
                    {secureCheckout && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ backgroundColor: bgColor === "#ffffff" ? "#f0fdf4" : "rgba(149,191,71,0.08)", color: accentColor }}>
                        <Lock className="w-3 h-3" /> SSL
                      </div>
                    )}
                  </div>

                  {/* Shipping */}
                  <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: bgColor === "#ffffff" ? "#f9fafb" : "rgba(255,255,255,0.03)" }}>
                    <Truck className="w-4 h-4 opacity-40" />
                    <div className="flex-1">
                      <p className="text-xs font-medium">{de ? "Kostenloser Versand" : "Free Shipping"}</p>
                      <p className="text-[10px] opacity-50">{de ? "3-7 Werktage" : "3-7 business days"}</p>
                    </div>
                    <Check className="w-4 h-4" style={{ color: accentColor }} />
                  </div>

                  {/* Total + CTA */}
                  <div className="pt-3 space-y-3" style={{ borderTop: `1px solid ${bgColor === "#ffffff" ? "#e5e7eb" : "rgba(255,255,255,0.1)"}` }}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="text-xl font-bold">49,99 &euro;</span>
                    </div>
                    <button
                      className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                      style={{ backgroundColor: accentColor, color: "#000" }}
                    >
                      <Lock className="w-4 h-4" />
                      {de ? "Jetzt kaufen" : "Buy Now"}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Sticky ATC Preview */}
                  {stickyAtc && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-3 rounded-xl mt-2"
                      style={{ backgroundColor: bgColor === "#ffffff" ? "#111" : "rgba(255,255,255,0.1)", border: "1px solid", borderColor: bgColor === "#ffffff" ? "#333" : "rgba(255,255,255,0.1)" }}
                    >
                      <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">Premium Product</p>
                        <p className="text-[10px] text-zinc-400">49,99 &euro;</p>
                      </div>
                      <button
                        className="px-4 py-2 rounded-lg text-xs font-bold shrink-0"
                        style={{ backgroundColor: accentColor, color: "#000" }}
                      >
                        {de ? "In den Warenkorb" : "Add to Cart"}
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-zinc-600 text-center mt-3">
                {de ? "Die Vorschau aktualisiert sich sofort bei jeder \u00C4nderung." : "Preview updates instantly with every change."}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
