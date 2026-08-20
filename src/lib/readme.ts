import type { JsonSchema } from "./store";

export function toolNameFor(valName: string): string {
  return valName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function leadParagraph(markdown: string): string | null {
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  for (const block of paragraphs) {
    if (block.startsWith("#") || block.startsWith("```") || block.startsWith(">")) continue;
    const text = block.replace(/\s+/g, " ").trim();
    if (text.length > 0) return text;
  }
  return null;
}

/** A val's own `description` is capped at 64 characters, so the schema cannot live there. */
export function firstJsonSchema(markdown: string): JsonSchema | null {
  const fences = markdown.matchAll(/```json\s*\n([\s\S]*?)```/gi);
  for (const fence of fences) {
    try {
      const parsed = JSON.parse(fence[1]) as JsonSchema;
      if (parsed && typeof parsed === "object" && (parsed.properties || parsed.type === "object")) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}
