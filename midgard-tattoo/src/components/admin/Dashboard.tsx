"use client";

// ─── Studio-Dashboard ────────────────────────────────────────────
// Die Startseite des Inhabers. Drei Zahlen oben, zwei Reiter darunter —
// mehr Struktur braucht es nicht, wenn ein Mensch einen Kalender und
// einen Posteingang verwaltet.
//
// Daten kommen aus zwei Endpunkten und werden nach jeder Aktion neu
// geladen. Bei diesen Datenmengen (ein Studio, ein paar hundert
// Termine) ist das schneller fertig als jede Cache-Invalidierung —
// und der Bildschirm zeigt garantiert den echten Stand.

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { todayKey } from "@/lib/types";
import { AdminCalendar } from "./AdminCalendar";
import { BookingInbox } from "./BookingInbox";
import type { AdminBooking, AdminSlot } from "./types";

type Tab = "calendar" | "inbox";

export function Dashboard({ studioName }: { studioName: string }) {
  const router = useRouter();
  const [slots, setSlots] = useState<AdminSlot[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [tab, setTab] = useState<Tab>("calendar");
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [slotRes, bookingRes] = await Promise.all([
        fetch("/api/admin/slots", { cache: "no-store" }),
        fetch("/api/admin/bookings", { cache: "no-store" }),
      ]);
      // Session abgelaufen → zurück zum Login, statt leere Listen zu zeigen.
      if (slotRes.status === 401 || bookingRes.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!slotRes.ok || !bookingRes.ok) throw new Error("load failed");
      const slotData = (await slotRes.json()) as { slots: AdminSlot[] };
      const bookingData = (await bookingRes.json()) as { bookings: AdminBooking[] };
      setSlots(slotData.slots ?? []);
      setBookings(bookingData.bookings ?? []);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Erstes Laden. Das `await` steht bewusst hier statt in einem
    // synchronen `void load()`: so ist sichtbar, dass jeder setState
    // erst nach der Antwort passiert — nicht schon beim Rendern.
    void (async () => {
      await load();
    })();
  }, [load]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
    router.refresh();
  }

  function openBooking(id: string) {
    setSelectedBooking(id);
    setTab("inbox");
  }

  const today = todayKey();
  const pending = bookings.filter((b) => b.status === "pending").length;
  const upcoming = slots.filter((s) => s.status === "booked" && s.date >= today).length;
  const free = slots.filter((s) => s.status === "open" && s.date >= today).length;

  return (
    <div className="min-h-[100svh]">
      <header className="sticky top-0 z-30" style={{ background: "rgba(11,11,12,0.9)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--ink-hair)" }}>
        <div className="shell flex h-[68px] items-center justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="display text-xl">{studioName.split(" ")[0]}</span>
            <span className="marker text-base" style={{ color: "var(--signal)" }}>Studio</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" rel="noopener" className="hidden text-xs underline underline-offset-4 sm:inline" style={{ color: "var(--bone-dim)" }}>
              Website ansehen
            </a>
            <button type="button" onClick={logout} className="btn btn-ghost h-10 px-4 text-[0.7rem]">
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <main className="shell py-8 md:py-12">
        {/* ── Kennzahlen ── */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <Kpi label="Offene Anfragen" value={pending} highlight={pending > 0} />
          <Kpi label="Feste Termine" value={upcoming} />
          <Kpi label="Frei buchbar" value={free} />
        </div>

        {/* ── Reiter ── */}
        <div className="mt-8 flex gap-2" role="tablist">
          {([
            { key: "calendar" as Tab, label: "Kalender" },
            { key: "inbox" as Tab, label: "Anfragen" },
          ]).map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className="relative min-h-[44px] px-1 pb-3 text-sm uppercase tracking-[0.12em] transition-colors"
              style={{ color: tab === item.key ? "var(--bone)" : "var(--bone-dim)" }}
            >
              {item.label}
              {item.key === "inbox" && pending > 0 && (
                <span
                  className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.65rem]"
                  style={{ background: "var(--signal)", color: "#131200" }}
                >
                  {pending}
                </span>
              )}
              {tab === item.key && (
                // `layoutId` lässt den Strich zwischen den Reitern
                // gleiten, statt hart umzuspringen.
                <motion.span
                  layoutId="admin-tab"
                  className="absolute inset-x-0 bottom-0 h-[2px]"
                  style={{ background: "var(--signal)" }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </button>
          ))}
        </div>
        <div className="mb-8 h-px" style={{ background: "var(--ink-hair)" }} />

        {failed && (
          <p className="mb-6 rounded p-3 text-sm" style={{ background: "rgba(226,86,74,0.1)", color: "var(--danger)" }}>
            Die Daten lassen sich gerade nicht laden.{" "}
            <button type="button" onClick={() => void load()} className="underline underline-offset-4">
              Erneut versuchen
            </button>
          </p>
        )}

        {loading ? (
          <p className="py-16 text-center text-sm" style={{ color: "var(--bone-dim)" }}>Wird geladen …</p>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {tab === "calendar" ? (
                <AdminCalendar slots={slots} onChanged={load} onOpenBooking={openBooking} />
              ) : (
                <BookingInbox
                  bookings={bookings}
                  selectedId={selectedBooking}
                  onSelect={setSelectedBooking}
                  onChanged={load}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="card p-4 md:p-5">
      <span
        className="display block text-3xl md:text-4xl"
        style={{ color: highlight ? "var(--signal)" : "var(--bone)" }}
      >
        {value}
      </span>
      <span className="eyebrow mt-2 block">{label}</span>
    </div>
  );
}
