import { listFiles, readFile } from "./api";
import { cacheReadme, cachedReadme } from "./cache";

/**
 * A val's README, read straight through the cache. `list_files` carries a per-file `version`, so the
 * listing alone says whether the cached copy is still current — the content is only fetched when it
 * is not. Missing is the common case, so nothing here treats it as an error.
 */
export async function loadReadme(val: string, signal?: AbortSignal): Promise<string | null> {
  const { files } = await listFiles(val, {}, signal);
  const found = files.find((file) => file.name.toUpperCase() === "README.MD");
  if (!found) return null;

  const cached = cachedReadme(val);
  if (cached?.version === found.version) return cached.content || null;

  const { content } = await readFile(val, found.path, {}, signal);
  cacheReadme(val, { version: found.version, content });
  return content || null;
}

/**
 * Warms an empty cache for a val the user has only hovered over. A val already in the cache costs
 * nothing here: opening it is what re-checks the version.
 */
export function prefetchReadme(val: string): void {
  if (cachedReadme(val)) return;
  void loadReadme(val).catch(() => undefined);
}
