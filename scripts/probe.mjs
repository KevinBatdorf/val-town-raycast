const token = process.env.VAL_TOWN_TOKEN;
let id = 0;

async function rpc(method, params) {
  const response = await fetch("https://api.val.town/v3/mcp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const body = await response.text();
  const data = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");
  return { status: response.status, message: JSON.parse(data || body) };
}

const wanted = ["listBlobs", "readBlob", "sqlite_execute", "get_logs", "get_traces", "list_files"];
const { message: list } = await rpc("tools/list", {});
for (const tool of list.result.tools.filter((tool) => wanted.includes(tool.name))) {
  console.log(`SCHEMA ${tool.name} ${JSON.stringify(tool.inputSchema)}`);
}

async function probe(name, args) {
  const { status, message } = await rpc("tools/call", { name, arguments: args });
  const result = message.result;
  if (message.error)
    return console.log(`CALL ${name} http ${status} rpc-error ${JSON.stringify(message.error).slice(0, 300)}`);
  if (result?.isError)
    return console.log(`CALL ${name} http ${status} isError ${(result.content?.[0]?.text ?? "").slice(0, 300)}`);
  console.log(`CALL ${name} http ${status} ok`);
  return result;
}

const val = "kevinb/raycast-db-fixture";
await probe("listBlobs", { storage: { type: "val", val } });
await probe("sqlite_execute", { sql: "SELECT 1", database: { type: "val", val } });
const files = await probe("list_files", { val });
const text = files?.content?.find((part) => part.type === "text")?.text ?? "";
const fileId = files?.structuredContent?.files?.[0]?.id ?? text.match(/"id":\s*"([^"]+)"/)?.[1];
console.log(`file id found: ${Boolean(fileId)}`);
if (fileId) {
  await probe("get_logs", { fileId });
  await probe("get_traces", { fileId });
}
