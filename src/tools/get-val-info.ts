import { endpointOf, listFiles, readFile } from "../lib/api";
import { requireBuiltin } from "../lib/builtins";

type Input = {
  /** The val as `handle/valName`, or a tool name from list-tools. */
  val: string;
  /** One file to read in full. Omit for the file listing and README. */
  path?: string;
};

export default async function getValInfo(input: Input) {
  const identifier = await resolveIdentifier(input.val);

  if (input.path) {
    const file = await readFile(identifier, input.path);
    return { val: identifier, path: input.path, fileType: file.fileType, content: file.content.slice(0, 40000) };
  }

  const { files } = await listFiles(identifier);
  const readme = files.find((file) => /^readme\.md$/i.test(file.name));

  let readmeContent: string | null = null;
  if (readme) {
    try {
      readmeContent = (await readFile(identifier, readme.path)).content.slice(0, 20000);
    } catch {
      readmeContent = null;
    }
  }

  return {
    val: identifier,
    files: files.map((file) => ({
      path: file.path,
      type: file.type,
      updatedAt: file.updatedAt,
      endpoint: endpointOf(file) ?? null,
    })),
    readme: readmeContent,
  };
}

async function resolveIdentifier(value: string): Promise<string> {
  const state = await requireBuiltin("get-val-info");
  if (value.includes("/")) return value;

  const match = Object.values(state.tools).find(
    (entry) => entry.spec?.name === value || entry.val.endsWith(`/${value}`),
  );
  if (match) return match.val;

  throw new Error(`"${value}" is not a val identifier. Use handle/valName, or a name from list-tools.`);
}
