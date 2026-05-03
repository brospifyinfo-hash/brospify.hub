// ─── /ai-tools/background-remover ────────────────────────────────
// Page shell for the Magic Background Remover. The actual feature
// lives in <MagicBackgroundRemover />.

import Navigation from "@/components/Navigation";
import MagicBackgroundRemover from "@/components/MagicBackgroundRemover";

export const metadata = {
  title: "Magic Background Remover · BrospifyHub",
};

export default function BackgroundRemoverPage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-mesh font-sf">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 md:py-16">
          <header className="mb-6 sm:mb-10 text-left">
            <div className="inline-flex items-center gap-2 mb-3 sm:mb-4">
              <span
                className="text-[10px] uppercase tracking-[0.2em] font-semibold"
                style={{ color: "#95BF47" }}
              >
                AI Tools
              </span>
            </div>
            <h1
              className="text-[26px] sm:text-[34px] md:text-[42px] font-semibold tracking-tight text-white leading-[1.08]"
              style={{ letterSpacing: "-0.025em" }}
            >
              Magic Background Remover
            </h1>
            <p className="mt-2.5 sm:mt-3 text-[13.5px] sm:text-[15px] text-zinc-400 max-w-xl leading-relaxed">
              Lade ein Produktfoto hoch — der Hintergrund wird pixelgenau
              entfernt. Wähle zwischen schnellem Standard und Präzise-Modus
              für feinste Kanten.
            </p>
          </header>

          <MagicBackgroundRemover />
        </div>
      </main>
    </>
  );
}
