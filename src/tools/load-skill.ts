import { findSkills } from "../lib/api";

type Input = {
  /**
   * What the user is trying to do, or the skill's name if they gave one. Matched against the
   * user's own skills.
   */
  query: string;
  /** How many skills to return. One is usually right. */
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
      note: `No skill of the user's own matched "${input.query}". Their skills live in a val under skills/<name>/SKILL.md. Do not substitute a Val Town platform guide.`,
    };
  }

  return {
    skills: personal.map((skill) => ({
      name: skill.name,
      description: skill.description,
      instructions: skill.content,
    })),
    note: "Follow these instructions. Each val the skill names is called with execute-tool; check list-tools for its exact name and input schema first.",
  };
}
