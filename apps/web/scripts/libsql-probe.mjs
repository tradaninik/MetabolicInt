import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
const tok = process.env.DATABASE_AUTH_TOKEN;

if (!url || !tok) {
  console.error("PROBE: missing DATABASE_URL or DATABASE_AUTH_TOKEN in env");
  process.exit(2);
}

console.log("PROBE: connecting to host:", new URL(url).host);
const client = createClient({ url, authToken: tok });

try {
  const r1 = await client.execute("SELECT 1 AS one");
  console.log("PROBE: SELECT 1 ok ->", JSON.stringify(r1.rows));
  const r2 = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log("PROBE: tables ->", r2.rows.map((r) => r.name).join(", "));
  console.log("PROBE: done");
} catch (e) {
  console.error("PROBE: RAW ERROR:");
  console.error(e && e.toString ? e.toString() : e);
  if (e && e.code) {
    console.error("code:", e.code);
  }
  process.exit(1);
}
