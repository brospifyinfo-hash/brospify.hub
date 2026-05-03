// ─── /ai-tools/hybrid-upscaler ───────────────────────────────────
// Page shell for the smart 2-way upscaler. The actual feature lives
// in <HybridUpscaler />; this file just provides the nav + hero.

import Navigation from "@/components/Navigation";
import HybridUpscaler from "@/components/HybridUpscaler";

export const metadata = {
  title: "Hybrid Upscaler · BrospifyHub",
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
              <span className="text-zinc-700">·</span>
              <span className="text-[10px] uppercase tracking-[0.18em] font-medium text-zinc-500">
                Hybrid · Lokal & Cloud
              </span>
            </div>
            <h1
              className="text-[34px] sm:text-[42px] font-semibold tracking-tight text-white leading-[1.05]"
              style={{ letterSpacing: "-0.025em" }}
            >
              Hybrid Upscaler
            </h1>
            <p className="mt-3 text-[15px] text-zinc-400 max-w-xl mx-auto sm:mx-0 leading-relaxed">
              Wähle zwischen kostenlosem Browser-Upscaling auf deiner GPU und
              maximaler Cloudinary-AI-Qualität — beides in einem Tool.
            </p>
          </header>

          <HybridUpscaler />
        </div>
      </main>
    </>
  );
}
