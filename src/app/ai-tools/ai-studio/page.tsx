// ─── /ai-tools/ai-studio ─────────────────────────────────────────
// Page shell for the AI Studio. The actual feature lives in
// <AiStudio />.

import Navigation from "@/components/Navigation";
import AiStudio from "@/components/AiStudio";

export const metadata = {
  title: "AI Studio · BrospifyHub",
};

export default function AiStudioPage() {
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
              AI Studio: Produkt-Fotografie
            </h1>
            <p className="mt-3 text-[15px] text-zinc-400 max-w-xl mx-auto sm:mx-0 leading-relaxed">
              Stelle dein Produkt in eine professionelle Szene — Marmor,
              Studio, Natur und mehr. Das Original bleibt 1:1 erhalten,
              nur Hintergrund und Schatten werden neu generiert.
            </p>
          </header>

          <AiStudio />
        </div>
      </main>
    </>
  );
}
