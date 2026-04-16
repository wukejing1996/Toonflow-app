import fs from "fs";
import crypto from "crypto";
import os from "os";
import child_process from "child_process";
import path from "path";
import getPath from "@/utils/getPath";
// Public key is loaded from a file bundled with the installer.

export interface LicensePayload {
  sub?: string;
  exp: string; // ISO string
  hwid?: string;
  ver?: number;
  features?: any;
}

export interface LicenseFile extends LicensePayload {
  sig: string; // base64
}

export function canonicalize(obj: any): string {
  function sort(o: any): any {
    if (Array.isArray(o)) return o.map(sort);
    if (o && typeof o === "object") {
      const keys = Object.keys(o).sort();
      const out: any = {};
      for (const k of keys) out[k] = sort(o[k]);
      return out;
    }
    return o;
  }
  return JSON.stringify(sort(obj));
}

export function getMachineId(): string {
  try {
    if (process.platform === "win32") {
      const out = child_process
        .execSync('reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', { stdio: ["ignore", "pipe", "ignore"] })
        .toString();
      const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i);
      if (m) return m[1].toLowerCase();
    } else if (process.platform === "darwin") {
      const out = child_process
        .execSync('ioreg -rd1 -c IOPlatformExpertDevice', { stdio: ["ignore", "pipe", "ignore"] })
        .toString();
      const m = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (m) return m[1].toLowerCase();
    } else {
      for (const p of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
        if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim().toLowerCase();
      }
    }
  } catch {}
  // 兜底：使用主机信息哈希（稳定性较差）
  return crypto.createHash("sha256").update(os.hostname() + os.arch() + os.platform()).digest("hex");
}

export function verifyLicense(
  license: LicenseFile,
  publicKeyPem: string,
): { ok: boolean; reason?: string; payload?: LicensePayload } {
  try {
    if (!license || typeof license !== "object") return { ok: false, reason: "许可文件结构无效" };
    const { sig, ...payload } = license as any;
    if (!sig) return { ok: false, reason: "缺少签名(sig)" };
    if (!payload.exp) return { ok: false, reason: "缺少到期(exp)" };

    const exp = new Date(payload.exp);
    if (isNaN(exp.getTime())) return { ok: false, reason: "到期时间格式错误" };
    if (new Date() > exp) return { ok: false, reason: "授权已到期" };

    if (payload.hwid) {
      const local = getMachineId();
      if (payload.hwid.toLowerCase() !== local.toLowerCase()) {
        return { ok: false, reason: "机器码不匹配" };
      }
    }

    const canon = canonicalize(payload);
    const data = Buffer.from(canon, "utf8");
    const signature = Buffer.from(sig, "base64");
    // 使用 ECDSA-P256 + SHA-256 验签
    const ok = crypto.verify("sha256", data, publicKeyPem, signature);
    if (!ok) return { ok: false, reason: "签名验证失败" };

    return { ok: true, payload };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "未知错误" };
  }
}

/**
 * 从磁盘读取文件完成校验。
 * 公钥查找顺序：data/serve/license_public.pem -> resources/data/serve/license_public.pem -> ./keys/public.pem
 * 许可文件查找顺序：data/serve/license.lic -> ./license.lic
 */
export function verifyFromDisk(): { ok: boolean; reason?: string; payload?: LicensePayload } {
  const log: any = { ts: new Date().toISOString(), step: 'verifyFromDisk', candidates: {} };
  try {
    const serveDir = getPath("serve");
    const candidatesPub = [
      path.join(serveDir, "license_public.pem"),
      path.join(process.resourcesPath || "", "data", "serve", "license_public.pem"),
      path.resolve(process.cwd(), "keys", "public.pem"),
    ];
    const candidatesLic = [
      path.join(serveDir, "license.lic"),
      path.resolve(process.cwd(), "license.lic"),
    ];
    log.candidates.pub = candidatesPub;
    log.candidates.lic = candidatesLic;
    const pubPath = candidatesPub.find((p) => fs.existsSync(p));
    const licPath = candidatesLic.find((p) => fs.existsSync(p));

    log.found = { pubPath, licPath };

    if (!pubPath) {
      log.error = '未找到公钥: license_public.pem';
      writeDebug(log);
      return { ok: false, reason: "未找到公钥：license_public.pem" };
    }
    if (!licPath) {
      log.error = '未找到许可文件: license.lic';
      writeDebug(log);
      return { ok: false, reason: "未找到许可文件：license.lic" };
    }

    const publicKeyPem = fs.readFileSync(pubPath, "utf8");
    const lic: LicenseFile = JSON.parse(fs.readFileSync(licPath, "utf8"));
    const st = verifyLicense(lic, publicKeyPem);
    log.result = st;
    writeDebug(log);
    return st;
  } catch (e: any) {
    log.exception = e?.message || String(e);
    writeDebug(log);
    return { ok: false, reason: e?.message ?? "读取或验证许可文件失败" };
  }
}



function writeDebug(data: any) {
  try {
    const dir = getPath('serve');
    const logPath = path.join(dir, 'license_debug.log');
    const line = JSON.stringify(data) + '\n';
    fs.appendFileSync(logPath, line, { encoding: 'utf8' });
  } catch {}
}
