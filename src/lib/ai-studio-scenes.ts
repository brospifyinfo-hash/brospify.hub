// ─── AI Studio Scene Catalog ────────────────────────────────────
// Hand-curated set of scene/lighting prompts for the AI Studio tool.
// Both the client carousel and the /api/ai-studio route pull from
// this list so the IDs stay in sync.
//
// `prompt` is fed to IC-Light v2 as the relighting prompt. IC-Light
// reasons jointly about lighting + scene, so prompts emphasise BOTH
// the surface/background AND the direction/quality of light. Concrete
// lighting words ("soft window light from the upper left", "rim light
// from the right") yield better shadows than abstract aesthetics.
//
// `negativePrompt` (optional) reins in known IC-Light failure modes —
// distortions, plastic-looking surfaces, color casts on the product.

export interface AiStudioScene {
  id: string;
  label: string;
  /** Short blurb under the label in the carousel. */
  hint: string;
  /** CSS gradient for the carousel thumbnail card. */
  swatch: string;
  /** IC-Light v2 `prompt`. */
  prompt: string;
  /** IC-Light v2 `negative_prompt` — appended to the global default. */
  negativePrompt?: string;
}

const NEGATIVE_BASE =
  "low quality, blurry, distorted, deformed, watermark, logo overlay, text artifact, oversaturated, plastic look";

export function buildNegativePrompt(scene: AiStudioScene): string {
  return scene.negativePrompt
    ? `${NEGATIVE_BASE}, ${scene.negativePrompt}`
    : NEGATIVE_BASE;
}

export const AI_STUDIO_SCENES: readonly AiStudioScene[] = [
  {
    id: "podium",
    label: "Minimalistisches Podest",
    hint: "Cleanes Studio-Podest, weiches Licht",
    swatch: "linear-gradient(135deg,#f5f5f7 0%,#d6d6da 100%)",
    prompt:
      "minimalist beige stone pedestal in a clean cream-coloured studio, soft diffused key light from the upper left, gentle ambient fill, faint contact shadow on the pedestal surface, premium product photography, shallow depth of field with creamy bokeh background",
  },
  {
    id: "studio",
    label: "Studio Licht",
    hint: "Heller Studio-Hintergrund, Catchlights",
    swatch: "linear-gradient(135deg,#ffffff 0%,#bcbcc2 100%)",
    prompt:
      "pure white seamless studio backdrop, two large softboxes producing crisp specular catchlights, faint floor reflection underneath the subject, professional bright high-key e-commerce product photography",
  },
  {
    id: "marble",
    label: "Marmor",
    hint: "Polierter Marmor, warmes Fensterlicht",
    swatch: "linear-gradient(135deg,#ece9e2 0%,#9d9489 100%)",
    prompt:
      "polished white Carrara marble surface with soft grey veins, warm golden window light from the side casting a long soft shadow, faint mirror-like reflection on the marble, blurred neutral wall behind, luxury editorial product shot",
  },
  {
    id: "nature",
    label: "Natur",
    hint: "Eukalyptus, Sonnenflecken, organisch",
    swatch: "linear-gradient(135deg,#c5d8b5 0%,#5d7a4e 100%)",
    prompt:
      "fresh eucalyptus leaves and small wildflowers around the subject on a smooth pale stone surface, dappled morning sunlight breaking through leaves, soft natural shadows, slightly out-of-focus green foliage in the background, organic lifestyle product photography",
  },
  {
    id: "linen",
    label: "Leinen Tisch",
    hint: "Beige Leinendecke, gemütlich",
    swatch: "linear-gradient(135deg,#e9dec9 0%,#a6916b 100%)",
    prompt:
      "draped beige linen tablecloth with gentle folds, warm golden-hour side light spilling across the fabric, soft directional shadow, blurred neutral wall behind, cozy editorial lifestyle photography",
  },
  {
    id: "concrete",
    label: "Beton Loft",
    hint: "Industriell, urban, kühl",
    swatch: "linear-gradient(135deg,#b3b3b3 0%,#4a4a4a 100%)",
    prompt:
      "flat polished concrete surface, large window light from the left producing a long soft shadow, blurred industrial loft background with raw concrete walls, modern minimalist product photography",
  },
  {
    id: "wood",
    label: "Walnuss Holz",
    hint: "Warmes Holz, sanftes Licht",
    swatch: "linear-gradient(135deg,#a87a4d 0%,#553a22 100%)",
    prompt:
      "warm dark walnut wood tabletop with visible grain, soft directional warm tungsten light from the upper right, blurred dark amber background, premium artisanal product photography",
  },
  {
    id: "beach",
    label: "Strand",
    hint: "Helles Tageslicht, sanfter Sand",
    swatch: "linear-gradient(135deg,#f3e7c9 0%,#88b6c8 100%)",
    prompt:
      "smooth fine beach sand with subtle ripples around the subject, bright soft midday sunlight, blurred turquoise ocean and pale sky in the background, breezy lifestyle product photography",
  },
  {
    id: "gradient-rose",
    label: "Rosé Gradient",
    hint: "Pastell, modern, soft",
    swatch: "linear-gradient(135deg,#ffd1d1 0%,#cf7d8c 100%)",
    prompt:
      "smooth rose-to-peach pastel gradient backdrop with subtle paper texture, soft even studio light, faint contact shadow underneath the subject, clean modern e-commerce product shot",
  },
  {
    id: "midnight",
    label: "Midnight Studio",
    hint: "Dunkler Hintergrund, Moody",
    swatch: "linear-gradient(135deg,#2a2a3a 0%,#0a0a18 100%)",
    prompt:
      "deep midnight-blue seamless studio backdrop, single rim light from the right creating a moody highlight on one side, faint reflection on a dark glossy floor, premium dramatic product photography",
  },
] as const;

export function findScene(id: string | null | undefined): AiStudioScene | null {
  if (!id) return null;
  return AI_STUDIO_SCENES.find((s) => s.id === id) ?? null;
}
