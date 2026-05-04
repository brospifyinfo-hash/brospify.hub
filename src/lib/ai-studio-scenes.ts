// ─── AI Studio Scene Catalog ────────────────────────────────────
// Hand-curated set of scene/lighting prompts for the AI Studio tool.
// Both the client carousel and the /api/ai-studio route pull from
// this list so the IDs stay in sync.
//
// `prompt` is fed to IC-Light v2 as the relighting prompt. IC-Light
// reasons jointly about lighting + scene, so prompts emphasise BOTH
// the surface/background AND the direction/quality of light.
//
// `visual` drives the rich carousel preview. The card is layered as:
//   bottom:  full background gradient
//            optional radial light spot
//            optional surface band (ground/podium)
//            stylised product silhouette
//   top:     glass label
// Every layer is pure CSS — no images to host or LCP costs.

export interface SceneVisual {
  /** Full-card gradient — usually a vertical sky-to-ground feel. */
  background: string;
  /** Optional radial light spot CSS (full background string). */
  light?: string;
  /** Optional surface/ground band gradient. */
  surface?: string;
  /** Tint of the product silhouette ("light" or "dark"). */
  product: "light" | "dark";
  /** Optional accent glow (additional layer). */
  accent?: string;
}

export interface AiStudioScene {
  id: string;
  label: string;
  /** Short blurb under the label in the carousel. */
  hint: string;
  /** IC-Light v2 `prompt`. */
  prompt: string;
  /** IC-Light v2 `negative_prompt` — appended to the global default. */
  negativePrompt?: string;
  /** Visual layers for the carousel preview card. */
  visual: SceneVisual;
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
    prompt:
      "minimalist beige stone pedestal in a clean cream-coloured studio, soft diffused key light from the upper left, gentle ambient fill, faint contact shadow on the pedestal surface, premium product photography, shallow depth of field with creamy bokeh background",
    visual: {
      background: "linear-gradient(180deg, #f5f1ea 0%, #e8e0d2 55%, #c9bda7 100%)",
      light:
        "radial-gradient(ellipse 70% 50% at 30% 18%, rgba(255, 250, 235, 0.55), transparent 60%)",
      surface:
        "linear-gradient(180deg, transparent 60%, rgba(80, 60, 35, 0.18) 100%)",
      product: "light",
    },
  },
  {
    id: "studio",
    label: "Studio Licht",
    hint: "Heller Studio-Hintergrund, Catchlights",
    prompt:
      "pure white seamless studio backdrop, two large softboxes producing crisp specular catchlights, faint floor reflection underneath the subject, professional bright high-key e-commerce product photography",
    visual: {
      background: "linear-gradient(180deg, #ffffff 0%, #f0f0f3 60%, #d4d4da 100%)",
      light:
        "radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.9), transparent 55%)",
      surface:
        "linear-gradient(180deg, transparent 65%, rgba(0, 0, 0, 0.10) 100%)",
      product: "dark",
    },
  },
  {
    id: "marble",
    label: "Marmor",
    hint: "Polierter Marmor, warmes Fensterlicht",
    prompt:
      "polished white Carrara marble surface with soft grey veins, warm golden window light from the side casting a long soft shadow, faint mirror-like reflection on the marble, blurred neutral wall behind, luxury editorial product shot",
    visual: {
      background: "linear-gradient(180deg, #efece4 0%, #d8d2c3 55%, #b5ac99 100%)",
      light:
        "radial-gradient(ellipse 60% 40% at 78% 22%, rgba(255, 220, 170, 0.45), transparent 55%)",
      surface:
        "linear-gradient(180deg, transparent 58%, rgba(60, 45, 25, 0.18) 100%)",
      product: "light",
      accent:
        "linear-gradient(85deg, transparent 65%, rgba(255, 220, 170, 0.18) 75%, transparent 90%)",
    },
  },
  {
    id: "nature",
    label: "Natur",
    hint: "Eukalyptus, Sonnenflecken, organisch",
    prompt:
      "fresh eucalyptus leaves and small wildflowers around the subject on a smooth pale stone surface, dappled morning sunlight breaking through leaves, soft natural shadows, slightly out-of-focus green foliage in the background, organic lifestyle product photography",
    visual: {
      background: "linear-gradient(180deg, #d4e3c5 0%, #8aab73 55%, #4d6b3e 100%)",
      light:
        "radial-gradient(ellipse 50% 40% at 75% 12%, rgba(255, 248, 200, 0.45), transparent 60%)",
      surface:
        "linear-gradient(180deg, transparent 60%, rgba(20, 35, 15, 0.30) 100%)",
      product: "light",
      accent:
        "radial-gradient(circle at 18% 78%, rgba(255, 248, 200, 0.18) 0%, transparent 30%)",
    },
  },
  {
    id: "linen",
    label: "Leinen Tisch",
    hint: "Beige Leinendecke, gemütlich",
    prompt:
      "draped beige linen tablecloth with gentle folds, warm golden-hour side light spilling across the fabric, soft directional shadow, blurred neutral wall behind, cozy editorial lifestyle photography",
    visual: {
      background: "linear-gradient(180deg, #f0e3cd 0%, #d4be95 60%, #9c8056 100%)",
      light:
        "radial-gradient(ellipse 65% 45% at 82% 20%, rgba(255, 215, 145, 0.55), transparent 60%)",
      surface:
        "linear-gradient(180deg, transparent 55%, rgba(70, 45, 20, 0.20) 100%)",
      product: "dark",
    },
  },
  {
    id: "concrete",
    label: "Beton Loft",
    hint: "Industriell, urban, kühl",
    prompt:
      "flat polished concrete surface, large window light from the left producing a long soft shadow, blurred industrial loft background with raw concrete walls, modern minimalist product photography",
    visual: {
      background: "linear-gradient(180deg, #c9c9cc 0%, #8a8a90 55%, #4a4a52 100%)",
      light:
        "radial-gradient(ellipse 60% 50% at 18% 25%, rgba(245, 245, 250, 0.55), transparent 60%)",
      surface:
        "linear-gradient(180deg, transparent 60%, rgba(0, 0, 0, 0.30) 100%)",
      product: "light",
    },
  },
  {
    id: "wood",
    label: "Walnuss Holz",
    hint: "Warmes Holz, sanftes Licht",
    prompt:
      "warm dark walnut wood tabletop with visible grain, soft directional warm tungsten light from the upper right, blurred dark amber background, premium artisanal product photography",
    visual: {
      background: "linear-gradient(180deg, #a07546 0%, #6b4628 55%, #3a2412 100%)",
      light:
        "radial-gradient(ellipse 55% 45% at 78% 18%, rgba(255, 200, 130, 0.55), transparent 60%)",
      surface:
        "linear-gradient(180deg, transparent 55%, rgba(0, 0, 0, 0.40) 100%)",
      product: "light",
    },
  },
  {
    id: "beach",
    label: "Strand",
    hint: "Helles Tageslicht, sanfter Sand",
    prompt:
      "smooth fine beach sand with subtle ripples around the subject, bright soft midday sunlight, blurred turquoise ocean and pale sky in the background, breezy lifestyle product photography",
    visual: {
      background: "linear-gradient(180deg, #c8e0e8 0%, #ecd9b5 55%, #c5a06f 100%)",
      light:
        "radial-gradient(circle at 50% 8%, rgba(255, 255, 240, 0.65), transparent 50%)",
      surface:
        "linear-gradient(180deg, transparent 55%, rgba(120, 90, 50, 0.22) 100%)",
      product: "dark",
    },
  },
  {
    id: "gradient-rose",
    label: "Rosé Gradient",
    hint: "Pastell, modern, soft",
    prompt:
      "smooth rose-to-peach pastel gradient backdrop with subtle paper texture, soft even studio light, faint contact shadow underneath the subject, clean modern e-commerce product shot",
    visual: {
      background: "linear-gradient(180deg, #ffd9d4 0%, #f0a3a8 55%, #b87280 100%)",
      light:
        "radial-gradient(ellipse 70% 50% at 50% 10%, rgba(255, 245, 240, 0.55), transparent 55%)",
      product: "light",
    },
  },
  {
    id: "midnight",
    label: "Midnight Studio",
    hint: "Dunkler Hintergrund, Moody",
    prompt:
      "deep midnight-blue seamless studio backdrop, single rim light from the right creating a moody highlight on one side, faint reflection on a dark glossy floor, premium dramatic product photography",
    visual: {
      background: "linear-gradient(180deg, #2a3252 0%, #141a30 55%, #06091a 100%)",
      light:
        "radial-gradient(ellipse 55% 60% at 85% 35%, rgba(140, 170, 255, 0.40), transparent 60%)",
      surface:
        "linear-gradient(180deg, transparent 55%, rgba(0, 0, 0, 0.55) 100%)",
      product: "light",
      accent:
        "linear-gradient(85deg, transparent 70%, rgba(160, 190, 255, 0.20) 80%, transparent 92%)",
    },
  },
] as const;

export function findScene(id: string | null | undefined): AiStudioScene | null {
  if (!id) return null;
  return AI_STUDIO_SCENES.find((s) => s.id === id) ?? null;
}

// ─── Background Remover precision tiers ─────────────────────────
// Two precision levels exposed in the UI. Server-side maps them to
// distinct Fal models — fast BRIA cutout vs slower BiRefNet for
// clean edges on hair, fur, and fine product details.

export type BgPrecision = "fast" | "precise" | "hair";

export interface BgPrecisionOption {
  id: BgPrecision;
  label: string;
  hint: string;
  /** Fal model identifier — use with `callFal`. */
  model: string;
  /** Optional per-model input overrides. */
  modelInputs?: Record<string, unknown>;
}

export const BG_PRECISION_OPTIONS: readonly BgPrecisionOption[] = [
  {
    id: "fast",
    label: "Schnell",
    hint: "BRIA RMBG-1.4 · 1–3 s, klare Produktkanten",
    model: "fal-ai/imageutils/rembg",
  },
  {
    id: "precise",
    label: "Präzise",
    hint: "BiRefNet v2 General Heavy · 5–10 s, knackige feine Details",
    model: "fal-ai/birefnet/v2",
    modelInputs: { model: "General Use (Heavy)" },
  },
  {
    id: "hair",
    label: "Haar / Fell",
    hint: "BiRefNet v2 Portrait · 6–10 s, perfekte Härchen-Kanten",
    model: "fal-ai/birefnet/v2",
    modelInputs: { model: "Portrait" },
  },
] as const;

export function findBgPrecision(
  id: string | null | undefined,
): BgPrecisionOption {
  return (
    BG_PRECISION_OPTIONS.find((p) => p.id === id) ?? BG_PRECISION_OPTIONS[0]
  );
}
