import { findSkills } from "../lib/api";
import { requireBuiltin } from "../lib/builtins";

type Input = {
  /** What the user wants to do, or the skill name they gave. */
  query: string;
  /** How many skills to return. */
  limit?: number;
};

export default async function loadSkill(input: Input) {
  const state = await requireBuiltin("load-skill");
  const limit = Math.min(Math.max(input.limit ?? 3, 1), 10);
  const { matches } = await findSkills(input.query, limit);

  // Unfiltered results are mostly Val Town's own platform guides.
  let personal = (matches ?? []).filter((skill) => skill.source === "personal");

  // An empty collection means the user never curated, not that every skill is off.
  const active = new Set(
    Object.values(state.skills)
      .filter((skill) => skill.enabled)
      .map((skill) => skill.name),
  );
  if (Object.keys(state.skills).length > 0) {
    personal = personal.filter((skill) => active.has(skill.name));
  }

  if (personal.length === 0) {
    return {
      skills: [],
      note: `No skill of the user's own matched "${input.query}". Do not substitute a Val Town platform guide.`,
    };
  }

  return {
    skills: personal.map((skill) => ({
      name: skill.name,
      description: skill.description,
      instructions: skill.content,
    })),
    note: "Follow these instructions. Call each val the skill names with execute-tool.",
  };
}
