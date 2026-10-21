import { createServerFn } from "@tanstack/react-start";
import { sanitizeAdviceWeather, type AdviceWeather } from "@/lib/weather";

const MODEL = "openai/gpt-6-astra";

export type AiResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

async function callResponses(body: Record<string, unknown>): Promise<AiResult<string>> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key)
    return { ok: false, code: "config", message: "Le service d'analyse n'est pas configuré." };
  let res: Response;
  try {
    res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        ...body,
      }),
    });
  } catch {
    return {
      ok: false,
      code: "network",
      message: "Service d'analyse injoignable. Vérifiez votre connexion.",
    };
  }
  if (!res.ok) {
    let msg = "";
    try {
      const j = await res.json();
      msg = j?.error?.message ?? j?.message ?? "";
    } catch {
      /* ignore */
    }
    const map: Record<number, string> = {
      400: "La photo n'a pas pu être lue par le service d'analyse.",
      401: "Le service d'analyse n'est pas configuré correctement.",
      402: "Crédits d'analyse épuisés pour cet espace.",
      403: "L'analyse est bloquée pour cet espace (autorisation ou limite).",
      429: "Trop de demandes, réessayez dans un instant.",
    };
    return {
      ok: false,
      code: String(res.status),
      message:
        map[res.status] ?? `Service d'analyse indisponible (${res.status}).${msg ? " " + msg : ""}`,
    };
  }
  const reader = res.body?.getReader();
  if (!reader) return { ok: false, code: "empty", message: "Réponse vide du service d'analyse." };
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let failed: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        else if (ev.type === "response.refusal.delta") failed = "refus";
        else if (ev.type === "error" || ev.type === "response.failed")
          failed = ev.error?.message ?? ev.response?.error?.message ?? "erreur";
      } catch {
        /* ignore partial */
      }
    }
  }
  if (failed === "refus")
    return { ok: false, code: "refusal", message: "Le service d'analyse a refusé cette image." };
  if (failed)
    return {
      ok: false,
      code: "failed",
      message: "L'analyse a échoué. Vous pouvez saisir la fiche vous-même.",
    };
  if (!text.trim())
    return {
      ok: false,
      code: "empty",
      message: "L'analyse n'a rien renvoyé. Saisissez la fiche vous-même.",
    };
  return { ok: true, data: text };
}

const COLOR_ENUM = [
  "noir",
  "blanc",
  "ecru",
  "gris",
  "beige",
  "camel",
  "marron",
  "marine",
  "bleu",
  "denim",
  "kaki",
  "vert",
  "rouge",
  "bordeaux",
  "rose",
  "orange",
  "jaune",
  "violet",
  "multicolore",
];

export interface GarmentSuggestion {
  isGarment: boolean;
  name: string;
  category: "haut" | "bas" | "chaussures" | "veste" | "accessoire" | "robe";
  colors: string[];
  pattern: string;
  style: string;
  seasons: string[];
  confidence: "faible" | "moyenne" | "elevee";
}

export const analyzeGarment = createServerFn({ method: "POST" })
  .inputValidator((input: { image: string }) => {
    if (typeof input?.image !== "string" || !input.image.startsWith("data:image/"))
      throw new Error("Image invalide");
    if (input.image.length > 4_000_000) throw new Error("Image trop lourde");
    return input;
  })
  .handler(async ({ data }): Promise<AiResult<GarmentSuggestion>> => {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: [
        "isGarment",
        "name",
        "category",
        "colors",
        "pattern",
        "style",
        "seasons",
        "confidence",
      ],
      properties: {
        isGarment: { type: "boolean" },
        name: { type: "string" },
        category: {
          type: "string",
          enum: ["haut", "bas", "chaussures", "veste", "accessoire", "robe"],
        },
        colors: { type: "array", items: { type: "string", enum: COLOR_ENUM } },
        pattern: {
          type: "string",
          enum: ["uni", "rayé", "carreaux", "fleuri", "pois", "imprimé", "texturé"],
        },
        style: {
          type: "string",
          enum: [
            "decontracte",
            "classique",
            "chic",
            "minimaliste",
            "sport",
            "boheme",
            "streetwear",
          ],
        },
        seasons: {
          type: "array",
          items: { type: "string", enum: ["printemps", "ete", "automne", "hiver"] },
        },
        confidence: { type: "string", enum: ["faible", "moyenne", "elevee"] },
      },
    };
    const r = await callResponses({
      instructions:
        "Tu identifies UNE pièce vestimentaire principale sur une photo. Réponds en français. Nom court et descriptif sans marque (ex: « Chemise oxford bleu ciel »). 1 à 3 couleurs dominantes, la principale en premier. N'invente jamais taille, matière ou composition. category 'robe' couvre robes et combinaisons. Si l'image ne montre pas de vêtement, isGarment=false.",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Analyse cette pièce." },
            { type: "input_image", image_url: data.image },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "garment", strict: true, schema } },
    });
    if (!r.ok) return r;
    try {
      return { ok: true, data: JSON.parse(r.data) as GarmentSuggestion };
    } catch {
      return {
        ok: false,
        code: "parse",
        message: "Réponse d'analyse illisible. Saisissez la fiche vous-même.",
      };
    }
  });

export interface OutfitAdvice {
  advice: { index: number; title: string; text: string }[];
}

export const adviseOutfits = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      occasion: string;
      style: string;
      temperature: number;
      level: string;
      weather?: AdviceWeather;
      outfits: {
        pieces: {
          category: string;
          name: string;
          colors: string[];
          pattern: string;
          style: string;
        }[];
      }[];
    }) => {
      if (!Array.isArray(input?.outfits) || input.outfits.length > 3)
        throw new Error("Entrée invalide");
      const weather = sanitizeAdviceWeather(input.weather);
      const base = {
        occasion: input.occasion,
        style: input.style,
        temperature: input.temperature,
        level: input.level,
        outfits: input.outfits,
      };
      return weather ? { ...base, weather } : base;
    },
  )
  .handler(async ({ data }): Promise<AiResult<OutfitAdvice>> => {
    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["advice"],
      properties: {
        advice: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["index", "title", "text"],
            properties: {
              index: { type: "integer" },
              title: { type: "string" },
              text: { type: "string" },
            },
          },
        },
      },
    };
    const r = await callResponses({
      instructions:
        "Tu es styliste. Pour chaque tenue fournie (composée UNIQUEMENT des pièces listées, n'en ajoute aucune), donne un titre évocateur (3-5 mots) et 2-3 phrases en français : harmonie des couleurs, proportions, comment la porter pour l'occasion. Si une météo est jointe (pluie, neige, vent, ressenti), ajoute un conseil de port concret sans inventer de vêtement absent. Ton chaleureux, inclusif, sans genre imposé, sans conseiller d'acheter.",
      input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify(data) }] }],
      text: { format: { type: "json_schema", name: "advice", strict: true, schema } },
    });
    if (!r.ok) return r;
    try {
      return { ok: true, data: JSON.parse(r.data) as OutfitAdvice };
    } catch {
      return { ok: false, code: "parse", message: "Conseil illisible." };
    }
  });
