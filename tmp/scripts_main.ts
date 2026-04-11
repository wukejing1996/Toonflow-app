import { app, BrowserWindow, protocol, dialog, shell } from "electron";
import path from "path";
import fs from "fs";
import Module from "module";

// 优化 Electron 启动：减少 GPU 缓存
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

const TARGET_ENTRIES = new Set(["assets", "models", "serve", "skills", "web"]);

declare const __APP_VERSION__: string;

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10)).filter(Number.isFinite);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10)).filter(Number.isFinite);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (!fs.existsSync(d)) fs.copyFileSync(s, d);
  }
}

function initializeData(): void {
  const srcDir = path.join(process.resourcesPath, "data");
  const destDir = path.join(app.getPath("userData"), "data");
  const versionFilePath = path.join(destDir, "version.txt");

  let shouldForceReplace = false;
  if (!fs.existsSync(versionFilePath)) {
    shouldForceReplace = true;
  } else {
    const localVersion = fs.readFileSync(versionFilePath, "utf-8").trim();
    if (compareVersions(localVersion, __APP_VERSION__) < 0) shouldForceReplace = true;
  }

  for (const dir of TARGET_ENTRIES) {
    const targetDir = path.join(destDir, dir);
    if (shouldForceReplace) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      copyDir(path.join(srcDir, dir), targetDir);
    } else if (!fs.existsSync(targetDir)) {
      copyDir(path.join(srcDir, dir), targetDir);
    }
  }

  if (shouldForceReplace) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(versionFilePath, `${__APP_VERSION__}\n`, "utf-8");
  }
}

// 获取 node_modules 查找路径（打包时优先从 unpacked 读取原生模块）
function getNodeModulesPaths(): string[] {
  const pathsArr: string[] = [];
  if (app.isPackaged) {
    const unpacked = path.join(process.resourcesPath, "app.asar.unpacked", "node_modules");
    if (fs.existsSync(unpacked)) pathsArr.push(unpacked);
    const asar = path.join(process.resourcesPath, "app.asar", "node_modules");
    pathsArr.push(asar);
  } else {
    pathsArr.push(path.join(process.cwd(), "node_modules"));
  }
  return pathsArr;
}

// 动态加载并临时扩展模块查找路径
function requireWithCustomPaths(modulePath: string): any {
  const appNodeModulesPaths = getNodeModulesPaths();
  const originalNodeModulePaths = (Module as any)._nodeModulePaths;
  (Module as any)._nodeModulePaths = function (from: string): string[] {
    const p = originalNodeModulePaths.call(this, from);
    for (let i = appNodeModulesPaths.length - 1; i >= 0; i--) {
      const nm = appNodeModulesPaths[i];
      if (!p.includes(nm)) p.unshift(nm);
    }
    return p;
  };
  try {
    delete require.cache[require.resolve(modulePath)];
    return require(modulePath);
  } finally {
    (Module as any)._nodeModulePaths = originalNodeModulePaths;
  }
}

let mainWindow: BrowserWindow | null = null;
let loadingWindow: BrowserWindow | null = null;
let licenseWindow: BrowserWindow | null = null;

const loadingHtml = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:#fff;color:#333;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  user-select:none;-webkit-app-region:drag}
.spinner{width:48px;height:48px;border:4px solid rgba(0,0,0,.1);
  border-top-color:#000;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
p{margin-top:20px;font-size:14px;opacity:.6}
</style>
</head>
<body>
  <div class="spinner"></div>
  <p>正在启动服务…</p>
</body>
</html>`)} `;

function showLoading(): void {
  loadingWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    show: true,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#ffffff", symbolColor: "#333333", height: 36 },
  });
  loadingWindow.setMenuBarVisibility(false);
  loadingWindow.removeMenu();
  loadingWindow.on("closed", () => (loadingWindow = null));
  void loadingWindow.loadURL(loadingHtml);
}

function closeLoading(): void {
  if (loadingWindow && !loadingWindow.isDestroyed()) {
    loadingWindow.close();
    loadingWindow = null;
  }
}

function createMainWindow(): Promise<void> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 1000,
      height: 700,
      minWidth: 800,
      minHeight: 500,
      frame: false,
      show: false,
      autoHideMenuBar: true,
      resizable: true,
      thickFrame: true,
    });
    mainWindow = win;
    win.setMenuBarVisibility(false);
    win.removeMenu();

    win.on("closed", () => (mainWindow = null));

    win.once("ready-to-show", () => {
      closeLoading();
      win.show();
      resolve();
    });

    const isDev = process.env.NODE_ENV === "dev" || !app.isPackaged;
    if (process.env.VITE_DEV) {
      void win.loadURL("http://localhost:50188");
    } else {
      const htmlPath = isDev
        ? path.join(process.cwd(), "data", "web", "index.html")
        : path.join(app.getPath("userData"), "data", "web", "index.html");
      void win.loadFile(htmlPath);
    }
  });
}

function getDataBaseDir(): string {
  return app.isPackaged ? path.join(app.getPath("userData"), "data") : path.join(process.cwd(), "data");
}

function canonicalize(obj: any): string {
  const sort = (o: any): any => {
    if (Array.isArray(o)) return o.map(sort);
    if (o && typeof o === "object") {
      const keys = Object.keys(o).sort();
      const out: any = {};
      for (const k of keys) out[k] = sort(o[k]);
      return out;
    }
    return o;
  };
  return JSON.stringify(sort(obj));
}

function getMachineId(): string {
  try {
    const cp = require("child_process");
    if (process.platform === "win32") {
      const out = cp.execSync(
        "reg query HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid",
        { stdio: ["ignore", "pipe", "ignore"] },
      ).toString();
      const m = out.match(/MachineGuid\s+REG_SZ\s+([\w-]+)/i);
      if (m) return m[1].toLowerCase();
    } else if (process.platform === "darwin") {
      const out = cp.execSync("ioreg -rd1 -c IOPlatformExpertDevice", { stdio: ["ignore", "pipe", "ignore"] }).toString();
      const m = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (m) return m[1].toLowerCase();
    } else {
      for (const p of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
        if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim().toLowerCase();
      }
    }
  } catch {}
  const os = require("os");
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(os.hostname() + os.arch() + os.platform()).digest("hex");
}

function verifyLicenseFromDisk(): { ok: boolean; reason?: string; payload?: any } {
  try {
    const base = getDataBaseDir();
    const pubCandidates = [
      path.join(base, "serve", "license_public.pem"),
      path.join(process.cwd(), "license_public.pem"),
      path.join(process.cwd(), "keys", "public.pem"),
    ];
    const licCandidates = [
      path.join(base, "serve", "license.lic"),
      path.join(process.cwd(), "license.lic"),
    ];
    const pubPath = pubCandidates.find((p) => fs.existsSync(p));
    if (!pubPath) return { ok: false, reason: "未找到公钥：license_public.pem" };
    const licPath = licCandidates.find((p) => fs.existsSync(p));
    if (!licPath) return { ok: false, reason: "未找到许可证：license.lic" };

    const publicKeyPem = fs.readFileSync(pubPath, "utf8");
    const lic = JSON.parse(fs.readFileSync(licPath, "utf8"));
    const { sig, ...payload } = lic;
    if (!payload.exp) return { ok: false, reason: "缺少到期(exp)" };
    const exp = new Date(payload.exp);
    if (isNaN(exp.getTime())) return { ok: false, reason: "到期时间格式错误" };
    if (new Date() > exp) return { ok: false, reason: "授权已到期" };
    if (payload.hwid) {
      const local = getMachineId();
      if (String(payload.hwid).toLowerCase() !== local.toLowerCase()) return { ok: false, reason: "机器码不匹配" };
    }
    const data = Buffer.from(canonicalize(payload), "utf8");
    const signature = Buffer.from(sig, "base64");
    const crypto = require("crypto");
    const ok = crypto.verify("sha256", data, publicKeyPem, signature);
    if (!ok) return { ok: false, reason: "签名验签失败" };
    return { ok: true, payload };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "未知错误" };
  }
}

function createLicenseWindow(): void {
  if (licenseWindow && !licenseWindow.isDestroyed()) {
    licenseWindow.focus();
    return;
  }
  const html = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>许可证验证</title>
    <style>
      *{box-sizing:border-box}
      body{margin:0;padding:24px;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#222}
      h1{font-size:18px;margin:0 0 12px}
      .box{border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px}
      .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      button{padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer}
      button.primary{background:#111827;color:#fff;border-color:#111827}
      .muted{color:#6b7280}
      #status{margin-top:8px}
    </style>
  </head>
  <body>
    <h1>需要授权验证</h1>
    <p class="muted">请上传授权文件（license.lic）。如未获得授权，请复制下方机器码并发送给管理员。</p>
    <div class="box">
      <div class="row"><strong>机器码：</strong><code id="hwid">-</code>
        <button id="copy">复制</button>
      </div>
      <div class="row" style="margin-top:10px">
        <button id="pick">选择许可证文件</button>
        <button id="open">打开许可证目录</button>
        <button id="check">刷新验证</button>
        <button id="launch" class="primary" disabled>开始使用</button>
      </div>
      <div id="status" class="muted">待验证…</div>
    </div>
    <script>
      const $ = (s)=>document.querySelector(s);
      async function call(name){ const r = await fetch('toonflow://'+name); return r.json(); }
      async function refresh(){
        const st = await call('licensestatus');
        const el=$('#status');
        if(st.ok){ el.textContent='授权有效，过期时间：'+(st.payload?.exp||''); $('#launch').disabled=false; }
        else { el.textContent='未通过：'+(st.reason||'未知原因'); $('#launch').disabled=true; }
      }
      async function init(){
        const id = await call('machineid'); $('#hwid').textContent=id.hwid||'-'; await refresh();
      }
      $('#copy').onclick=()=>{ navigator.clipboard.writeText($('#hwid').textContent); };
      $('#pick').onclick=async()=>{ await call('licensepick'); await refresh(); };
      $('#open').onclick=()=>{ call('licenseopenfolder'); };
      $('#check').onclick=refresh;
      $('#launch').onclick=async()=>{ const r=await call('licenselaunch'); if(!r.ok) alert('仍未通过：'+(r.reason||'')); };
      init();
    </script>
  </body>
  </html>`)} `;

  licenseWindow = new BrowserWindow({
    width: 720,
    height: 420,
    resizable: false,
    show: true,
    autoHideMenuBar: true,
    title: "授权验证",
    backgroundColor: "#ffffff",
    parent: loadingWindow ?? undefined,
  });
  licenseWindow.on("closed", () => (licenseWindow = null));
  void licenseWindow.loadURL(html);
}

let closeServeFn: (() => Promise<void>) | undefined;

protocol.registerSchemesAsPrivileged([
  { scheme: "toonflow", privileges: { secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

app.whenReady().then(async () => {
  showLoading();
  try {
    // Always register protocol handlers first
    protocol.handle("toonflow", (request) => {
      const url = new URL(request.url);
      const pathname = url.hostname.toLowerCase();
      const handlers: Record<string, () => object> = {
        machineid: () => ({ hwid: getMachineId() }),
        licensestatus: () => verifyLicenseFromDisk(),
        licensepick: () => {
          const base = getDataBaseDir();
          const dir = path.join(base, "serve");
          fs.mkdirSync(dir, { recursive: true });
          const res = dialog.showOpenDialogSync({ properties: ["openFile"], filters: [{ name: "License", extensions: ["lic", "json"] }] });
          if (res && res[0]) { const to = path.join(dir, "license.lic"); fs.copyFileSync(res[0], to); return { ok: true, path: to }; }
          return { ok: false, canceled: true };
        },
        licenseopenfolder: () => { const base = getDataBaseDir(); shell.openPath(path.join(base, "serve")); return { ok: true }; },
        licenselaunch: () => {
          const st = verifyLicenseFromDisk();
          if (!st.ok) return st;
          // Defer backend start; the renderer calls this after upload
          startAndLaunch().then(() => { if (licenseWindow && !licenseWindow.isDestroyed()) licenseWindow.close(); createMainWindow(); }).catch((e)=>{
            console.error('[backend start failed]', e);
          });
          return { ok: true };
        },
        getappurl: () => ({ url: process.env.URL ?? (process.env.PORT ? `http://localhost:${process.env.PORT}/api` : '') }),
      };
      const handler = handlers[pathname];
      const responseData = handler ? handler() : { error: "未知接口" };
      return new Response(JSON.stringify(responseData), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    });

    // Gate on license before starting backend
    const st = verifyLicenseFromDisk();
    if (st.ok) {
      await startAndLaunch();
      await createMainWindow();
    } else {
      createLicenseWindow();
      closeLoading();
    }
  } catch (err) {
    console.error("[服务启动失败]:", err);
    createLicenseWindow();
  }
});
          const res = dialog.showOpenDialogSync({ properties: ["openFile"], filters: [{ name: "License", extensions: ["lic", "json"] }] });
          if (res && res[0]) { const to = path.join(dir, "license.lic"); fs.copyFileSync(res[0], to); return { ok: true, path: to }; }
          return { ok: false, canceled: true };
        },
        licenseopenfolder: () => { const base = getDataBaseDir(); shell.openPath(path.join(base, "serve")); return { ok: true }; },
        licenselaunch: () => { const st = verifyLicenseFromDisk(); if (!st.ok) return st; if (licenseWindow && !licenseWindow.isDestroyed()) licenseWindow.close(); void createMainWindow(); return { ok: true }; },
        getappurl: () => ({ url: process.env.URL ?? `http://localhost:${port}/api` }),
        windowminimize: () => { mainWindow?.minimize(); return { ok: true } },
        windowmaximize: () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); return { ok: true } },
        windowclose: () => { app.exit(0); return { ok: true } },
        opendevtool: () => { mainWindow?.webContents.openDevTools(); return { ok: true } },
      };
      const handler = handlers[pathname];
      const responseData = handler ? handler() : { error: "未知接口" };
      return new Response(JSON.stringify(responseData), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    });

    // 授权检查：通过后打开主窗口，否则展示授权界面
    const st = verifyLicenseFromDisk();
    if (st.ok) await createMainWindow();
    else { createLicenseWindow(); closeLoading(); }
  } catch (err) {
    console.error("[服务启动失败]:", err);
    await createMainWindow();
  }
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
app.on("before-quit", async () => { if (closeServeFn) await closeServeFn(); });
