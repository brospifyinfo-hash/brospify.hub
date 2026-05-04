// ─── /ai-tools/hybrid-upscaler ───────────────────────────────────
// Page shell for the image upscaler. The actual feature lives in
// <HybridUpscaler />; this file just provides the nav + hero.

import Navigation from "@/components/Navigation";
import HybridUpscaler from "@/components/HybridUpscaler";

export const metadata = {
  title: "Image Upscaler · BrospifyHub",
};

export default function HybridUpscalerPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-mesh font-sf">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
          <header className="mb-10 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 mb-4">
              <span
                className="text-[10px] uppercase tracking-[0.2em] font-semibold"
                style={{ color: "#95BF47" }}
              >
                AI Tools
              </span>
            </div>
            <h1
              className="text-[34px] sm:text-[42px] font-semibold tracking-tight text-white leading-[1.05]"
              style={{ letterSpacing: "-0.025em" }}
            >
              Image Upscaler
            </h1>
            <p className="mt-3 text-[15px] text-zinc-400 max-w-xl mx-auto sm:mx-0 leading-relaxed">
              Drei Modi für Foto, Gesichter oder Grafik — wähle 2× oder 4×
              und vergleich Vorher/Nachher direkt im Slider. Speicher das
              Ergebnis in einem Klick in deine Mediathek.
            </p>
          </header>

          <HybridUpscaler />
        </div>
      </main>
    </>
  );
}
