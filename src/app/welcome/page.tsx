"use client";

import { useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";
import GuidedTour from "@/components/GuidedTour";

export default function WelcomePage() {
  const router = useRouter();

  async function handleComplete() {
    // Mark onboarding as complete in Profil_JSON
    try {
      await fetch("/api/profile/onboarding", { method: "POST" });
    } catch {
      // continue even if this fails
    }
    router.push("/home");
  }

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      {/* Dummy content behind the tour so spotlight targets exist */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div data-tour="charts" className="glass rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-bold mb-2">Winning Product Charts</h2>
          <p className="text-zinc-400 text-sm">Deine Top-Produkte erscheinen hier.</p>
        </div>
        <div data-tour="themes" className="glass rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-bold mb-2">Premium Themes</h2>
          <p className="text-zinc-400 text-sm">Installiere Themes mit einem Klick.</p>
        </div>
        <div data-tour="profile" className="glass rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-2">Dein Profil</h2>
          <p className="text-zinc-400 text-sm">Verwalte deine Einstellungen.</p>
        </div>
      </main>

      <GuidedTour onComplete={handleComplete} />
    </div>
  );
}
