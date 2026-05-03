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
              AI Studio: Produkt-Fotografie
            </h1>
            <p className="mt-2.5 sm:mt-3 text-[13.5px] sm:text-[15px] text-zinc-400 max-w-xl leading-relaxed">
              Stelle dein Produkt in eine professionelle Szene — Marmor,
              Studio, Natur und mehr. Die KI passt Belichtung, Position
              und Schatten passend zur Umgebung an.
            </p>
          </header>

          <AiStudio />
        </div>
      </main>
    </>
  );
}
