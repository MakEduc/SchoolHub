import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const root = join(process.cwd(), ".next", "static");
const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) { console.error("The server key is not configured."); process.exit(1); }
let scanned = 0;
async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path,entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(js|json|map)$/.test(entry.name)) {
      scanned++;
      if ((await readFile(file,"utf8")).includes(secret)) throw new Error("A privileged key was found in a client asset.");
    }
  }
}
try { await scan(root); console.log(`Checked ${scanned} client assets: no configured privileged key present.`); }
catch (e) { console.error(e.message); process.exitCode = 1; }
