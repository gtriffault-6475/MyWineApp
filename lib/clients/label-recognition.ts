import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const LABEL_MODEL = "claude-haiku-5-5";

const RecognizedWineSchema = z.object({
  name: z.string().nullable(),
  producer: z.string().nullable(),
  appellation: z.string().nullable(),
  vintage: z.string().nullable(),
});

export type RecognizedWine = z.infer<typeof RecognizedWineSchema>;

// Même consigne que l'app iOS (services/wineRecognition.ts), le format JSON
// étant désormais garanti par les sorties structurées.
const PROMPT =
  "Analyse cette étiquette de vin et extrais les informations suivantes : " +
  "le nom du vin, le producteur ou domaine, l'appellation ou AOC, et le millésime (4 chiffres). " +
  "Si une information est absente ou illisible, utilise null pour ce champ.";

let client: Anthropic | null = null;

export class LabelRecognitionError extends Error {}

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Lit une étiquette (JPEG) et renvoie les champs reconnus, null si illisibles. */
export async function recognizeWineLabel(jpeg: Buffer): Promise<RecognizedWine> {
  client ??= new Anthropic();
  const response = await client.messages.parse({
    model: LABEL_MODEL,
    max_tokens: 4096,
    // Extraction simple : effort bas = plus rapide et moins cher.
    output_config: { effort: "low", format: zodOutputFormat(RecognizedWineSchema) },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new LabelRecognitionError("Le modèle a refusé d'analyser cette photo.");
  }
  const parsed = response.parsed_output;
  if (!parsed) {
    throw new LabelRecognitionError("Impossible d'interpréter la réponse du modèle.");
  }

  const vintage = clean(parsed.vintage);
  return {
    name: clean(parsed.name),
    producer: clean(parsed.producer),
    appellation: clean(parsed.appellation),
    // Comme iOS, seul un millésime à 4 chiffres est repris dans le formulaire.
    vintage: vintage && /^\d{4}$/.test(vintage) ? vintage : null,
  };
}
