import fs from "fs";
import path from "path";

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

const vendorDir = path.resolve("data", "vendor");
const files = fs
  .readdirSync(vendorDir)
  .filter((f) => f.endsWith(".ts"))
  .sort((a, b) => a.localeCompare(b));

const result: Record<string, string> = {};
for (const file of files) {
  result[file] = fs.readFileSync(path.join(vendorDir, file), "utf-8");
}

// Runtime copy used by extraResources.
writeJson(path.join(vendorDir, "vendor.json"), result);
// Build-time embed used by backend bundle (fixDB.ts imports it).
writeJson(path.resolve("src", "lib", "vendor.json"), result);

console.log(`Done, saved vendor.json (${files.length} vendors)`);
