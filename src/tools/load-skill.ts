import { findSkills } from "../lib/api";

type Input = {
  /** What the user wants to do, or the skill name they gave. */
  query: string;
  /** How many skills to return. */
  limit?: number;
};

export default async function loadSkill(input: Input) {
  const limit = Math.min(Math.max(input.limit ?? 3, 1), 10);
  const { matches } = await findSkills(input.query, limit);

  // Unfiltered results are mostly Val Town's own platform guides.
  const personal = (matches ?? []).filter((skill) => skill.source === "personal");

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
