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
        <div className="max-w-3xl lg:max-w-4xl mx-auto px-3 sm:px-5 py-3 sm:py-5 lg:py-8">
          <header className="mb-3 sm:mb-4">
            <div className="text-[9px] uppercase tracking-[0.18em] font-semibold mb-1" style={{ color: "#95BF47" }}>
              AI Tools
            </div>
            <h1 className="text-[18px] sm:text-[22px] font-semibold tracking-tight text-white leading-tight">
              Image Upscaler
            </h1>
            <p className="mt-1 text-[11px] sm:text-xs text-zinc-500 leading-snug">
              3 Modi · 2× / 4× · Before-After-Slider · 1-Klick in Mediathek
            </p>
          </header>

          <HybridUpscaler />
        </div>
      </main>
    </>
  );
}
