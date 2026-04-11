import fs from "fs";
import path from "path";
import crypto from "crypto";
import { canonicalize, LicenseFile, LicensePayload } from "@/utils/license";

function usage() {
  console.log(`\njulongAI License Generator\n\nCommands:\n  gen-keypair --out <dir>\n    Generate ECDSA P-256 keypair (private.pem, public.pem).\n\n  issue --priv <private.pem> --out <license.lic> --exp <YYYY-MM-DD> [--sub <str>] [--hwid <id>] [--features <json>] [--ver <n>]\n    Issue a signed license file.\n\nExamples:\n  tsx scripts/licensegen.ts gen-keypair --out ./keys\n  tsx scripts/licensegen.ts issue --priv ./keys/private.pem --out ./license.lic --sub "ACME" --exp 2027-12-31 --hwid 0123abcd...\n`);
}

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
  return undefined;
}

function has(flag: string): boolean { return process.argv.includes(flag); }

async function genKeypair() {
  const out = getArg("--out") ?? "./keys";
  fs.mkdirSync(out, { recursive: true });
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pubPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const privPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  fs.writeFileSync(path.join(out, "public.pem"), pubPem, "utf8");
  fs.writeFileSync(path.join(out, "private.pem"), privPem, "utf8");
  console.log(`\n✅ Keypair written to ${path.resolve(out)}\n  - public.pem\n  - private.pem\n`);
  console.log("Copy public.pem into data/serve/license_public.pem before build.");
}

async function issue() {
  const privPath = getArg("--priv");
  const outPath = getArg("--out") ?? "license.lic";
  const exp = getArg("--exp");
  if (!privPath || !exp) {
    console.error("Missing --priv or --exp");
    usage();
    process.exit(1);
  }
  const sub = getArg("--sub");
  const hwid = getArg("--hwid");
  const ver = getArg("--ver") ? Number(getArg("--ver")) : 1;
  let features: any = undefined;
  const featuresArg = getArg("--features");
  if (featuresArg) {
    try { features = JSON.parse(featuresArg); } catch { console.warn("--features JSON parse failed, ignored"); }
  }
  const payload: LicensePayload = { sub, exp: new Date(exp).toISOString(), hwid, ver, features };
  // remove undefined keys for stable canonicalization
  Object.keys(payload).forEach((k) => (payload as any)[k] === undefined && delete (payload as any)[k]);
  const canon = canonicalize(payload);
  const privateKeyPem = fs.readFileSync(privPath, "utf8");
  const sig = crypto.sign("sha256", Buffer.from(canon, "utf8"), privateKeyPem).toString("base64");
  const lic: LicenseFile = { ...payload, sig };
  fs.writeFileSync(outPath, JSON.stringify(lic, null, 2), "utf8");
  console.log(`\n✅ License written: ${path.resolve(outPath)}\nSubject: ${sub ?? "(none)"}\nExpiry:  ${payload.exp}\nHWID:    ${hwid ?? "(none)"}\nVersion: ${ver}\n`);
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd === "-h" || cmd === "--help") return usage();
  if (cmd === "gen-keypair") return genKeypair();
  if (cmd === "issue") return issue();
  console.error(`Unknown command: ${cmd}`); usage(); process.exit(1);
}

void main();



