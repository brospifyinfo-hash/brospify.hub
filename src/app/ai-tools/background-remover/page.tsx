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
              Magic Background Remover
            </h1>
            <p className="mt-3 text-[15px] text-zinc-400 max-w-xl mx-auto sm:mx-0 leading-relaxed">
              Lade ein Produktfoto hoch — der Hintergrund wird pixelgenau
              entfernt. Das Produkt selbst bleibt unverändert, inkl. Texten
              und Logos.
            </p>
          </header>

          <MagicBackgroundRemover />
        </div>
      </main>
    </>
  );
}
