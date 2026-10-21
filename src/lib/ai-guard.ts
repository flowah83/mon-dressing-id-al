import { AI_DAILY_LIMIT, type AiKind } from "./quota";
import { sanitizeAdviceWeather, type AdviceWeather } from "./weather";

export type AiFailure = { ok: false; code: string; message: string };

export type QuotaDecision =
  | { ok: true; remaining: number }
  | { ok: false; code: "limit" | "auth" | "invalid" | "unavailable" };

const MAX_IMAGE_CHARS = 4_000_000;
const MAX_IMAGE_BYTES = 3_000_000;
const IMAGE_PREFIX = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

function failure(code: string, message: string): AiFailure {
  return { ok: false, code, message };
}

export function messageFor(
  kind: AiKind,
  reason: "config" | "signed-out" | "expired" | "limit" | "unavailable",
): string {
  if (reason === "config") {
    return kind === "analysis"
      ? "L'analyse automatique n'est pas encore activée."
      : "Le conseil du styliste n'est pas encore activé.";
  }
  if (reason === "signed-out") {
    return kind === "analysis"
      ? "Connectez-vous pour utiliser l'analyse photo (Réglages, puis Compte)."
      : "Connectez-vous pour le conseil du styliste (Réglages, puis Compte).";
  }
  if (reason === "expired") {
    return "Votre connexion a expiré. Reconnectez-vous, puis réessayez.";
  }
  if (reason === "limit") {
    return kind === "analysis"
      ? `Vous avez atteint les ${AI_DAILY_LIMIT} analyses photo d'aujourd'hui. Le compteur repart à zéro cette nuit.`
      : `Vous avez atteint les ${AI_DAILY_LIMIT} conseils d'aujourd'hui. Le compteur repart à zéro cette nuit.`;
  }
  return kind === "analysis"
    ? "L'analyse n'a pas pu vérifier votre compte. Réessayez dans un instant."
    : "Le conseil n'a pas pu vérifier votre compte. Réessayez dans un instant.";
}

export function screenGarmentImage(image: unknown): { ok: true; image: string } | AiFailure {
  if (typeof image !== "string" || !image)
    return failure("invalid", "Cette photo n'est pas dans un format accepté (JPEG, PNG ou WebP).");
  if (image.length > MAX_IMAGE_CHARS)
    return failure("invalid", "Cette photo est trop lourde pour l'analyse.");
  if (!IMAGE_PREFIX.test(image))
    return failure("invalid", "Cette photo n'est pas dans un format accepté (JPEG, PNG ou WebP).");
  const comma = image.indexOf(",");
  const b64 = comma >= 0 ? image.slice(comma + 1) : "";
  if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    return failure("invalid", "Cette photo n'est pas dans un format accepté (JPEG, PNG ou WebP).");
  }
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const bytes = Math.floor((b64.length * 3) / 4) - padding;
  if (bytes <= 0 || bytes > MAX_IMAGE_BYTES)
    return failure("invalid", "Cette photo est trop lourde pour l'analyse.");
  return { ok: true, image };
}

export interface AdvicePiece {
  category: string;
  name: string;
  colors: string[];
  pattern: string;
  style: string;
}

export interface AdvicePayload {
  occasion: string;
  style: string;
  temperature: number;
  level: string;
  outfits: { pieces: AdvicePiece[] }[];
  weather?: AdviceWeather;
}

function shortText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > max) return null;
  return text;
}

export function screenAdvice(input: unknown): { ok: true; data: AdvicePayload } | AiFailure {
  const invalid = failure("invalid", "La demande de conseil est incomplète ou trop volumineuse.");
  if (!input || typeof input !== "object") return invalid;
  const raw = input as Record<string, unknown>;
  const occasion = shortText(raw["occasion"], 40);
  const style = shortText(raw["style"], 40);
  const level = shortText(raw["level"], 40);
  const temperature = raw["temperature"];
  if (
    !occasion ||
    !style ||
    !level ||
    typeof temperature !== "number" ||
    !Number.isFinite(temperature)
  )
    return invalid;
  if (temperature < -40 || temperature > 60) return invalid;
  if (!Array.isArray(raw["outfits"]) || raw["outfits"].length < 1 || raw["outfits"].length > 3)
    return invalid;

  const outfits: AdvicePayload["outfits"] = [];
  for (const outfit of raw["outfits"]) {
    if (!outfit || typeof outfit !== "object") return invalid;
    const piecesRaw = (outfit as { pieces?: unknown }).pieces;
    if (!Array.isArray(piecesRaw) || piecesRaw.length < 1 || piecesRaw.length > 8) return invalid;
    const pieces: AdvicePiece[] = [];
    for (const piece of piecesRaw) {
      if (!piece || typeof piece !== "object") return invalid;
      const row = piece as Record<string, unknown>;
      const category = shortText(row["category"], 40);
      const name = shortText(row["name"], 200);
      const pattern = shortText(row["pattern"], 40);
      const pieceStyle = shortText(row["style"], 40);
      if (!category || !name || !pattern || !pieceStyle) return invalid;
      if (!Array.isArray(row["colors"]) || row["colors"].length < 1 || row["colors"].length > 8)
        return invalid;
      const colors: string[] = [];
      for (const color of row["colors"]) {
        const label = shortText(color, 30);
        if (!label) return invalid;
        colors.push(label);
      }
      pieces.push({ category, name, colors, pattern, style: pieceStyle });
    }
    outfits.push({ pieces });
  }

  const weather = sanitizeAdviceWeather(raw["weather"]);
  const data: AdvicePayload = {
    occasion,
    style,
    temperature,
    level,
    outfits,
    ...(weather ? { weather } : {}),
  };
  if (JSON.stringify(data).length > 20_000) return invalid;
  return { ok: true, data };
}

export function interpretQuotaPayload(data: unknown): QuotaDecision {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return { ok: false, code: "unavailable" };
    }
  }
  if (!value || typeof value !== "object") return { ok: false, code: "unavailable" };
  const row = value as Record<string, unknown>;
  if (row["ok"] === true) {
    return { ok: true, remaining: typeof row["remaining"] === "number" ? row["remaining"] : 0 };
  }
  if (row["code"] === "limit") return { ok: false, code: "limit" };
  if (row["code"] === "auth") return { ok: false, code: "auth" };
  if (row["code"] === "invalid") return { ok: false, code: "invalid" };
  return { ok: false, code: "unavailable" };
}

/**
 * Server-side gate: Cloud must be configured, the access token must belong to
 * a real user, and that user must still have quota. The model is not called
 * unless this returns ok.
 */
export async function authorizeAiCall(input: {
  token: string | null;
  kind: AiKind;
  configured: boolean;
  verify: (token: string) => Promise<{ id: string } | null>;
  consume: (token: string, kind: AiKind) => Promise<QuotaDecision>;
}): Promise<{ ok: true; userId: string } | AiFailure> {
  if (!input.configured) return failure("config", messageFor(input.kind, "config"));
  if (!input.token) return failure("auth", messageFor(input.kind, "signed-out"));

  let user: { id: string } | null = null;
  try {
    user = await input.verify(input.token);
  } catch {
    return failure("unavailable", messageFor(input.kind, "unavailable"));
  }
  if (!user?.id) return failure("auth", messageFor(input.kind, "expired"));

  let quota: QuotaDecision;
  try {
    quota = await input.consume(input.token, input.kind);
  } catch {
    return failure("unavailable", messageFor(input.kind, "unavailable"));
  }
  if (quota.ok) return { ok: true, userId: user.id };
  if (quota.code === "limit") return failure("limit", messageFor(input.kind, "limit"));
  if (quota.code === "auth") return failure("auth", messageFor(input.kind, "expired"));
  return failure("unavailable", messageFor(input.kind, "unavailable"));
}
