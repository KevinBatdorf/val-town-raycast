import { sqliteExecute } from "../src/lib/api";
import { loadState } from "../src/lib/store";
import getValInfo from "../src/tools/get-val-info";
import getValRuns from "../src/tools/get-val-runs";
import listTools from "../src/tools/list-tools";
import loadSkill from "../src/tools/load-skill";
import readValBlobs from "../src/tools/read-val-blobs";

if (!process.env.VAL_TOWN_TOKEN) {
  console.error("Set VAL_TOWN_TOKEN to a Val Town API token.");
  process.exit(1);
}

let failed = false;

async function check<T>(name: string, run: () => Promise<T>): Promise<T | undefined> {
  try {
    const result = await run();
    console.log(`ok    ${name}`);
    return result;
  } catch (error) {
    // The log is public, and what follows the colon can quote the account's data.
    const reason = error instanceof Error ? error.message.split(":")[0] : "unknown error";
    console.error(`FAIL  ${name}: ${reason}`);
    failed = true;
  }
}

const listed = await check("list-tools", listTools);
if (!listed) process.exit(1);

// list-tools drops switched-off vals, which the read tools still accept.
const [val] = Object.keys((await loadState()).tools);
if (!val) {
  console.error(`FAIL  no val to read: ${listed.note}`);
  process.exit(1);
}

await check("get-val-info", () => getValInfo({ val }));
await check("get-val-runs", () => getValRuns({ val }));
const blobs = await check("read-val-blobs list", () => readValBlobs({ val }));
const key = blobs?.blobs?.[0]?.key;
if (key) await check("read-val-blobs read", () => readValBlobs({ val, key }));
await check("load-skill", () => loadSkill({ query: "sqlite" }));
await check("sqlite", () => sqliteExecute(val, "SELECT 1"));

process.exit(failed ? 1 : 0);
