// ─── Fal.ai client ──────────────────────────────────────────────
// Tiny queue-based wrapper. We submit to `https://queue.fal.run/<model>`,
// poll the status URL until the job COMPLETES, then GET the response
// URL. This is more reliable than the synchronous `fal.run` endpoint
// for models that take >30 s (IC-Light occasionally does on cold paths).
//
// Auth: header `Authorization: Key <FAL_KEY>`. Don't use Bearer.

const FAL_BASE = "https://queue.fal.run";
// Poll until the prediction completes or we exhaust this budget.
const DEFAULT_DEADLINE_MS = 240_000;
const POLL_INITIAL_MS = 600;
const POLL_MAX_MS = 3000;

export class FalError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "FalError";
  }
}

interface FalSubmitResponse {
  request_id: string;
  status_url: string;
  response_url: string;
  cancel_url?: string;
  queue_position?: number;
}

interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | string;
  queue_position?: number;
  logs?: Array<{ message: string; level?: string }>;
}

export async function callFal<T>(
  model: string,
  input: Record<string, unknown>,
  opts: { deadlineMs?: number } = {},
): Promise<T> {
  const key = process.env.FAL_KEY;
  if (!key) {
    throw new FalError("FAL_KEY ist nicht gesetzt.", 500);
  }
  const deadline = Date.now() + (opts.deadlineMs ?? DEFAULT_DEADLINE_MS);

  // 1) Submit
  const submitRes = await fetch(`${FAL_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const submitText = await submitRes.text();
  if (!submitRes.ok) {
    throw new FalError(
      `Fal-Submit fehlgeschlagen (${submitRes.status}): ${submitText.slice(0, 300)}`,
      submitRes.status,
      submitText,
    );
  }
  let submit: FalSubmitResponse;
  try {
    submit = JSON.parse(submitText);
  } catch {
    throw new FalError(
      `Fal antwortete unerwartet beim Submit: ${submitText.slice(0, 300)}`,
      502,
    );
  }
  if (!submit.status_url || !submit.response_url) {
    throw new FalError("Fal-Submit lieferte keine Status-URL.", 502);
  }

  // 2) Poll until done
  let delay = POLL_INITIAL_MS;
  let lastStatus: FalStatusResponse | null = null;
  while (Date.now() < deadline) {
    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.4), POLL_MAX_MS);
    try {
      const sRes = await fetch(submit.status_url, {
        headers: { Authorization: `Key ${key}` },
        cache: "no-store",
      });
      if (!sRes.ok) continue;
      const sJson = (await sRes.json()) as FalStatusResponse;
      lastStatus = sJson;
      if (sJson.status === "COMPLETED") break;
      if (sJson.status === "FAILED") {
        const lastLog = sJson.logs?.[sJson.logs.length - 1]?.message;
        throw new FalError(
          `Fal-Job fehlgeschlagen${lastLog ? `: ${lastLog}` : "."}`,
          502,
          sJson,
        );
      }
    } catch (err) {
      if (err instanceof FalError) throw err;
      // transient — keep polling
    }
  }
  if (!lastStatus || lastStatus.status !== "COMPLETED") {
    throw new FalError(
      "Fal-Job hat das Zeitlimit überschritten.",
      504,
      lastStatus,
    );
  }

  // 3) Fetch result
  const rRes = await fetch(submit.response_url, {
    headers: { Authorization: `Key ${key}` },
    cache: "no-store",
  });
  const rText = await rRes.text();
  if (!rRes.ok) {
    throw new FalError(
      `Fal-Result fehlgeschlagen (${rRes.status}): ${rText.slice(0, 300)}`,
      rRes.status,
      rText,
    );
  }
  try {
    return JSON.parse(rText) as T;
  } catch {
    throw new FalError(
      `Fal-Result war kein JSON: ${rText.slice(0, 300)}`,
      502,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Model-specific response shapes ────────────────────────────

export interface RembgResponse {
  image: {
    url: string;
    content_type: string;
    width?: number;
    height?: number;
  };
}

export interface IcLightResponse {
  images: Array<{
    url: string;
    content_type: string;
    width?: number;
    height?: number;
  }>;
  seed?: number;
}
