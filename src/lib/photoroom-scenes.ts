// ─── AI Studio Scene Catalog ────────────────────────────────────
// Hand-curated set of background prompts for the AI Studio tool.
// Both the client carousel and the /api/photoroom/ai-studio route
// pull from this list so the IDs stay in sync.
//
// `prompt` is fed to Photoroom's `background.prompt`. We pass
// `background.expandPrompt.mode=ai.never` server-side, so wording
// matters — keep prompts concrete (lighting, surface, distance,
// camera angle) rather than abstract.
//
// `shadow` picks Photoroom's AI shadow style. Soft for natural
// scenes, hard for high-key studio. The shadow is rendered BELOW
// the cutout — it never modifies the product pixels themselves.

export interface AiStudioScene {
  id: string;
  label: string;
  /** Short blurb under the label in the carousel. */
  hint: string;
  /** Tailwind-friendly gradient for the thumbnail card. */
  swatch: string;
  /** Photoroom `background.prompt`. */
  prompt: string;
  /** Photoroom `shadow.mode`. */
  shadow:
    | "ai.soft"
    | "ai.hard"
    | "ai.floating"
    | "ai.preset-soft"
    | "ai.preset-hard";
}

export const AI_STUDIO_SCENES: readonly AiStudioScene[] = [
  {
    id: "podium",
    label: "Minimalistisches Podest",
    hint: "Cleanes Studio-Podest, weiches Licht",
    swatch: "linear-gradient(135deg,#f5f5f7 0%,#d6d6da 100%)",
    prompt:
      "A minimalist beige stone pedestal, soft diffused studio light from the upper left, seamless cream backdrop, subtle ambient occlusion, premium product photography composition, depth of field bokeh background",
    shadow: "ai.soft",
  },
  {
    id: "studio",
    label: "Studio Licht",
    hint: "Heller Studio-Hintergrund, Catchlights",
    swatch: "linear-gradient(135deg,#ffffff 0%,#bcbcc2 100%)",
    prompt:
      "A pure white seamless studio backdrop, two large softboxes producing crisp catchlights, faint floor reflection, professional e-commerce product photography, clean and bright",
    shadow: "ai.hard",
  },
  {
    id: "marble",
    label: "Marmor",
    hint: "Polierter Marmor mit warmem Licht",
    swatch: "linear-gradient(135deg,#ece9e2 0%,#9d9489 100%)",
    prompt:
      "A polished white Carrara marble surface with soft grey veins, warm window light from the side, faint reflection on the marble, blurred neutral background, luxury editorial product shot",
    shadow: "ai.soft",
  },
  {
    id: "nature",
    label: "Natur",
    hint: "Eukalyptus, Sonnenflecken, organisch",
    swatch: "linear-gradient(135deg,#c5d8b5 0%,#5d7a4e 100%)",
    prompt:
      "Fresh eucalyptus leaves and small wildflowers on a smooth pale stone surface, dappled morning sunlight, soft natural shadows, slightly out-of-focus green foliage in the background, organic lifestyle product photography",
    shadow: "ai.soft",
  },
  {
    id: "linen",
    label: "Leinen Tisch",
    hint: "Beige Leinendecke, gemütlich",
    swatch: "linear-gradient(135deg,#e9dec9 0%,#a6916b 100%)",
    prompt:
      "A draped beige linen tablecloth with soft folds, warm golden-hour side light, blurred neutral wall behind, cozy editorial lifestyle photography",
    shadow: "ai.soft",
  },
  {
    id: "concrete",
    label: "Beton Loft",
    hint: "Industriell, urban, kühl",
    swatch: "linear-gradient(135deg,#b3b3b3 0%,#4a4a4a 100%)",
    prompt:
      "A flat polished concrete surface, large window light from the left producing a long soft shadow, blurred industrial loft background with concrete walls, modern minimalist product photography",
    shadow: "ai.soft",
  },
  {
    id: "wood",
    label: "Walnuss Holz",
    hint: "Warmes Holz, sanftes Licht",
    swatch: "linear-gradient(135deg,#a87a4d 0%,#553a22 100%)",
    prompt:
      "A warm dark walnut wood tabletop with visible grain, soft directional warm light from the upper right, blurred dark amber background, premium artisanal product photography",
    shadow: "ai.soft",
  },
  {
    id: "beach",
    label: "Strand",
    hint: "Helles Licht, sanfter Sand",
    swatch: "linear-gradient(135deg,#f3e7c9 0%,#88b6c8 100%)",
    prompt:
      "Smooth fine beach sand with subtle ripples, bright soft midday sunlight, blurred turquoise ocean and pale sky in the background, breezy lifestyle product photography",
    shadow: "ai.soft",
  },
  {
    id: "gradient-rose",
    label: "Rosé Gradient",
    hint: "Pastell, modern, soft",
    swatch: "linear-gradient(135deg,#ffd1d1 0%,#cf7d8c 100%)",
    prompt:
      "A smooth rose-to-peach pastel gradient backdrop with very subtle paper texture, soft even studio light, faint contact shadow, clean modern e-commerce product shot",
    shadow: "ai.soft",
  },
  {
    id: "midnight",
    label: "Midnight Studio",
    hint: "Dunkler Hintergrund, Moody",
    swatch: "linear-gradient(135deg,#2a2a3a 0%,#0a0a18 100%)",
    prompt:
      "A deep midnight-blue seamless studio backdrop, single rim light from the right creating a moody highlight, faint reflection on a dark glossy surface, premium dramatic product photography",
    shadow: "ai.hard",
  },
] as const;

export function findScene(id: string | null | undefined): AiStudioScene | null {
  if (!id) return null;
  return AI_STUDIO_SCENES.find((s) => s.id === id) ?? null;
}
