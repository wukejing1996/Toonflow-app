import fs from "fs";
import path from "path";
import crypto from "crypto";
import { canonicalize, LicenseFile, LicensePayload } from "@/utils/license";

function usage() {
  console.log(
    `\njulongAI License Generator\n\nCommands:\n  gen-keypair --out <dir>\n    Generate ECDSA P-256 keypair (private.pem, public.pem).\n\n  sync-public --pub <public.pem> [--to <file>]\n    Sync public key file into the app resources directory.\n    Default destination: data/serve/license_public.pem\n\n  issue --priv <private.pem> --exp <YYYY-MM-DD> [--hwid <id>] [--sub <str>] [--features <json>] [--ver <n>] [--dir <outputDir>] [--out <fileName>] [--with-public]\n    Issue a signed license file. Output layout is always grouped by HWID:\n      <outputDir>/<hwid>/<fileName>\n\n    Notes:\n      - If --dir is not provided, defaults to ./licenses\n      - If --out is not provided, defaults to license.lic\n      - Public key is bundled with the installer; you usually only send license.lic\n\nExamples:\n  yarn licensegen gen-keypair --out ./keys\n  yarn licensegen sync-public --pub ./keys/public.pem\n  yarn licensegen issue --priv ./keys/private.pem --dir ./licenses --sub "ACME" --exp 2027-12-31 --hwid 0123abcd...\n`,
  );
}

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
  return undefined;
}

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

function sanitizeDirName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new Error(`Invalid directory name: ${name}`);
  }
  return cleaned;
}

async function genKeypair() {
  const out = getArg("--out") ?? "./keys";
  fs.mkdirSync(out, { recursive: true });
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pubPem = publicKey.export({ format: "pem", type: "spki" }).toString();
  const privPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  fs.writeFileSync(path.join(out, "public.pem"), pubPem, "utf8");
  fs.writeFileSync(path.join(out, "private.pem"), privPem, "utf8");
  console.log(`\nKeypair written to ${path.resolve(out)}\n  - public.pem\n  - private.pem\n`);
  console.log("Next: run `yarn licensegen sync-public --pub keys/public.pem` to sync public key into app resources.");
}

async function syncPublic() {
  const pubPath = getArg("--pub");
  const outPath = getArg("--to") ?? path.resolve("data", "serve", "license_public.pem");
  if (!pubPath) {
    console.error("Missing --pub");
    usage();
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const pubPem = fs.readFileSync(pubPath, "utf8");
  fs.writeFileSync(outPath, pubPem, "utf8");
  console.log(`\nPublic key synced: ${path.resolve(outPath)}\n`);
}

async function issue() {
  const privPath = getArg("--priv");
  const outArg = getArg("--out");
  const outDir = getArg("--dir") ?? "./licenses";
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

  const hwidFolder = sanitizeDirName(hwid ?? "common");
  const targetDir = path.resolve(outDir, hwidFolder);
  fs.mkdirSync(targetDir, { recursive: true });

  // `--out` is treated as a filename (not a path) to keep outputs grouped by HWID.
  const outName = outArg ? path.basename(outArg) : "license.lic";
  const outPath = path.join(targetDir, outName);
  fs.writeFileSync(outPath, JSON.stringify(lic, null, 2), "utf8");

  const shouldWritePublic = has("--with-public");
  if (shouldWritePublic) {
    try {
      const privKeyObj = crypto.createPrivateKey(privateKeyPem);
      const pubKeyObj = crypto.createPublicKey(privKeyObj);
      const pubPem = pubKeyObj.export({ format: "pem", type: "spki" }).toString();
      fs.writeFileSync(path.join(targetDir, "license_public.pem"), pubPem, "utf8");
    } catch (e: any) {
      console.warn("\nWarning: Failed to write license_public.pem:", e?.message ?? e);
    }
  }

  console.log(`\nLicense written: ${path.resolve(outPath)}\nSubject: ${sub ?? "(none)"}\nExpiry:  ${payload.exp}\nHWID:    ${hwid ?? "(none)"}\nVersion: ${ver}\n`);
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd === "-h" || cmd === "--help") return usage();
  if (cmd === "gen-keypair") return genKeypair();
  if (cmd === "sync-public") return syncPublic();
  if (cmd === "issue") return issue();
  console.error(`Unknown command: ${cmd}`); usage(); process.exit(1);
}

void main();
