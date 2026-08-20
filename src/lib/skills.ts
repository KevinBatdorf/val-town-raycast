import { listFiles, readFile } from "./api";
import { mutateState, skillKey, type ExtensionState, type SkillEntry } from "./store";
import type { ValSummary } from "./types";

export type FoundSkill = {
  val: string;
  path: string;
  name: string;
  description: string;
};

/** `find_val_town_skills` is query-only and names no val, so walking the files is the only listing. */
export async function scanSkills(vals: ValSummary[], signal?: AbortSignal): Promise<FoundSkill[]> {
  const perVal = await Promise.all(vals.map((val) => scanVal(val.identifier, signal)));
  return perVal.flat().sort((a, b) => a.name.localeCompare(b.name));
}

async function scanVal(val: string, signal?: AbortSignal): Promise<FoundSkill[]> {
  let directories: string[];
  try {
    const { files } = await listFiles(val, { path: "skills" }, signal);
    directories = files.filter((file) => file.type === "directory").map((file) => file.path);
  } catch {
    // A val without a `skills` directory answers "File not found", which is not worth surfacing.
    return [];
  }

  const found = await Promise.all(
    directories.map(async (directory): Promise<FoundSkill | null> => {
      try {
        const { files } = await listFiles(val, { path: directory }, signal);
        const skill = files.find((file) => file.name.toUpperCase() === "SKILL.MD");
        if (!skill) return null;

        const { content } = await readFile(val, skill.path, {}, signal);
        const front = frontmatter(content);
        return {
          val,
          path: skill.path,
          name: front.name || directory.split("/").pop() || skill.path,
          description: front.description || firstLine(content),
        };
      } catch {
        return null;
      }
    }),
  );

  return found.filter((skill): skill is FoundSkill => skill !== null);
}

/** Val Town strips these two keys from a skill body, so they are what the model sees. */
function frontmatter(body: string): { name?: string; description?: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(body.trim());
  if (!match) return {};

  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (pair) fields[pair[1].toLowerCase()] = pair[2].trim().replace(/^["']|["']$/g, "");
  }
  return { name: fields.name, description: fields.description };
}

function firstLine(body: string): string {
  const line = body
    .replace(/^---[\s\S]*?---/, "")
    .split(/\r?\n/)
    .map((text) => text.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  return line ?? "";
}

export async function addSkill(skill: FoundSkill): Promise<ExtensionState> {
  const entry: SkillEntry = { ...skill, enabled: true, addedAt: new Date().toISOString() };
  return mutateState((state) => ({
    ...state,
    skills: { ...state.skills, [skillKey(skill.val, skill.path)]: entry },
  }));
}

export async function removeSkill(val: string, path: string): Promise<ExtensionState> {
  return mutateState((state) => {
    const skills = { ...state.skills };
    delete skills[skillKey(val, path)];
    return { ...state, skills };
  });
}
