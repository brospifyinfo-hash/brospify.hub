"use client";

/**
 * TemplateCard — Eine der 10 Cards im Auswahl-Grid.
 *
 * Glasmorphismus + feiner weißer Rand, hover-Lift, Shopify-grüner Status-Dot,
 * wenn das Template bereits live ist (also vom Nutzer schonmal generiert &
 * deployed wurde — erkennbar daran, dass `customized` true ist).
 */

import {
  ShoppingBag,
  Truck,
  ShoppingCart,
  Sparkles,
  RefreshCcw,
  PackageSearch,
  UserCheck,
  KeyRound,
  Gift,
  FileText,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import type { EmailTemplateMeta } from "@/lib/email-templates";

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingBag,
  Truck,
  ShoppingCart,
  Sparkles,
  RefreshCcw,
  PackageSearch,
  UserCheck,
  KeyRound,
  Gift,
  FileText,
};

interface Props {
  meta: EmailTemplateMeta;
  customized?: boolean;
  onClick: () => void;
}

export default function TemplateCard({ meta, customized, onClick }: Props) {
  const Icon = ICON_MAP[meta.icon] ?? ShoppingBag;

  return (
    <button
      onClick={onClick}
      className="glass glass-hover group relative flex flex-col items-start text-left p-6 rounded-3xl cursor-pointer w-full h-full hover:-translate-y-0.5"
    >
      {customized && (
        <span className="absolute top-5 right-5 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#95BF47] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-[#95BF47] shadow-[0_0_10px_#95BF47]" />
          Live
        </span>
      )}

      <div className="w-11 h-11 rounded-2xl glass-strong flex items-center justify-center mb-5">
        <Icon className="w-5 h-5 text-white/90" strokeWidth={1.6} />
      </div>

      <h3 className="text-[17px] font-semibold text-white tracking-tight mb-1.5">
        {meta.title}
      </h3>
      <p className="text-[13px] leading-relaxed text-white/55 mb-5 flex-1">
        {meta.description}
      </p>

      <div className="flex items-center justify-between w-full mt-auto pt-4 border-t border-white/10">
        <span className="text-[11px] text-white/40 uppercase tracking-wider">
          {meta.trigger}
        </span>
        <ArrowRight
          className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition"
          strokeWidth={1.8}
        />
      </div>
    </button>
  );
}
