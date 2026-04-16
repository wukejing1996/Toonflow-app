import { app, BrowserWindow, protocol, dialog, shell } from "electron";
import path from "path";
import fs from "fs";
import Module from "module";
import { verifyFromDisk, getMachineId } from "@/utils/license";
import getPath from "@/utils/getPath";
// 加速 Electron 启动：跳过 GPU 信息收集，减少初始化耗时
const isDev = !!process.env.VITE_DEV || !app.isPackaged;
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
const TARGET_ENTRIES = new Set(["assets", "models", "serve", "skills", "web", "vendor"]);
const RUNTIME_ENTRIES = new Set(["logs", "oss", "temp"]);
function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.existsSync(d) || fs.copyFileSync(s, d);
  }
}
declare const __APP_VERSION__: string;
function compareVersions(a: string, b: string): number {
  const pa = a
    .split(".")
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isFinite(n));
  const pb = b
    .split(".")
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isFinite(n));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
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
    if (compareVersions(localVersion, __APP_VERSION__) < 0) {
      shouldForceReplace = true;
    }
  }
  fs.mkdirSync(destDir, { recursive: true });
  for (const dir of TARGET_ENTRIES) {
    const targetDir = path.join(destDir, dir);
    if (shouldForceReplace) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      copyDir(path.join(srcDir, dir), targetDir);
      continue;
    }
    // Ensure directory exists even if resources are missing.
    fs.mkdirSync(targetDir, { recursive: true });
    // Always copy missing files into existing directories.
    copyDir(path.join(srcDir, dir), targetDir);
  }
  for (const dir of RUNTIME_ENTRIES) {
    fs.mkdirSync(path.join(destDir, dir), { recursive: true });
  }
  if (shouldForceReplace) {
    fs.writeFileSync(versionFilePath, `${__APP_VERSION__}\n`, "utf-8");
  }
}
//获取全部依赖路径，优先从 unpacked 加载原生模块，其他模块从 asar 加载
function getNodeModulesPaths(): string[] {
  const paths: string[] = [];
  if (app.isPackaged) {
    // external 依赖（原生模块）在 unpacked 目录
    const unpackedNodeModules = path.join(process.resourcesPath, "app.asar.unpacked", "node_modules");
    if (fs.existsSync(unpackedNodeModules)) {
      paths.push(unpackedNodeModules);
    }
    // 普通依赖在 asar 内
    const asarNodeModules = path.join(process.resourcesPath, "app.asar", "node_modules");
    paths.push(asarNodeModules);
  } else {
    paths.push(path.join(process.cwd(), "node_modules"));
  }
  return paths;
}
//动态加载
function requireWithCustomPaths(modulePath: string): any {
  const appNodeModulesPaths = getNodeModulesPaths();
  // 保存原始方法
  const originalNodeModulePaths = (Module as any)._nodeModulePaths;
  // 临时修改模块路径解析
  (Module as any)._nodeModulePaths = function (from: string): string[] {
    const paths = originalNodeModulePaths.call(this, from);
    // 将主程序的 node_modules 添加到前面
    for (let i = appNodeModulesPaths.length - 1; i >= 0; i--) {
      const p = appNodeModulesPaths[i];
      if (!paths.includes(p)) {
        paths.unshift(p);
      }
    }
    return paths;
  };
  try {
    // 清除缓存确保加载最新
    delete require.cache[require.resolve(modulePath)];
    return require(modulePath);
  } finally {
    // 恢复原始方法
    (Module as any)._nodeModulePaths = originalNodeModulePaths;
  }
}
let mainWindow: BrowserWindow | null = null;
let loadingWindow: BrowserWindow | null = null;
let licenseWindow: BrowserWindow | null = null;
let isAuthorized = false;
const loadingHtml = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:#fff;color:#333;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  user-select:none;-webkit-app-region:drag}
.spinner{width:48px;height:48px;border:4px solid rgba(0,0,0,.1);
  border-top-color:#000;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
p{margin-top:20px;font-size:14px;opacity:.6}
</style></head><body><div class="spinner"></div><p>正在启动服务…</p></body></html>`)}`;
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
    titleBarOverlay: {
      color: "#ffffff",
      symbolColor: "#333333",
      height: 36,
    },
  });
  loadingWindow.setMenuBarVisibility(false);
  loadingWindow.removeMenu();
  loadingWindow.on("closed", () => {
    loadingWindow = null;
  });
  void loadingWindow.loadURL(loadingHtml);
}
function closeLoading(): void {
  if (loadingWindow && !loadingWindow.isDestroyed()) {
    loadingWindow.close();
    loadingWindow = null;
  }
}
function resolvePreloadPath(): string | undefined {
  try {
    if (app.isPackaged) return path.join(__dirname, "preload.js");
    const dev = path.join(process.cwd(), "build", "preload.js");
    return fs.existsSync(dev) ? dev : undefined;
  } catch { return undefined; }
}
let pageLoadedFlag = false;
let uiReadyFlag = false;
let pendingShowResolve: (() => void) | null = null;
function tryShowMainWindow() {
  if (mainWindow && pageLoadedFlag && uiReadyFlag) {
    closeLoading();
    mainWindow.show();
    try { pendingShowResolve?.(); } catch {}
    pendingShowResolve = null;
  }
}function createMainWindow(): Promise<void> {
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
      webPreferences: (() => { const p = resolvePreloadPath(); const wp = { contextIsolation: true, nodeIntegration: false, sandbox: false } as any; if (p) (wp as any).preload = p; return wp; })(),
    });
    mainWindow = win;
    win.setMenuBarVisibility(false);
    win.removeMenu();
        win.on("page-title-updated", (e) => { e.preventDefault(); try { win.setTitle("JulongAI"); } catch {} });win.on("closed", () => {
      mainWindow = null;
    });
    win.once("ready-to-show", () => { pendingShowResolve = resolve; tryShowMainWindow(); });
    win.webContents.on("did-finish-load", () => { pageLoadedFlag = true; tryShowMainWindow(); });
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
let closeServeFn: (() => Promise<void>) | undefined;
// 许可校验 UI
function createLicenseWindow(): void {
  if (licenseWindow && !licenseWindow.isDestroyed()) {
    licenseWindow.focus();
    return;
  }
  const html = `data:text/html;charset=utf-8,${encodeURIComponent(
    `<!DOCTYPE html>`+
    `<html><head><meta charset="utf-8">`+
    `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: toonflow:; connect-src toonflow:;">`+
    `<title>授权验证</title>`+
    `<style>`+
    `*{box-sizing:border-box}body{margin:0;font:14px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;background:#fff;color:#222}`+
    `.wrap{max-width:720px;margin:0 auto;padding:24px}`+
    `h1{font-size:20px;margin:0 0 12px} p{margin:8px 0}`+
    `.box{border:1px solid #e5e5e5;border-radius:8px;padding:16px;background:#fafafa}`+
    `.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}`+
    `code{background:#f0f0f0;padding:4px 8px;border-radius:4px}`+
    `button{padding:8px 12px;border:1px solid #d0d0d0;border-radius:6px;background:#fff;cursor:pointer}`+
    `button.primary{background:#111;color:#fff;border-color:#111}`+
    `button:disabled{opacity:.5;cursor:not-allowed}`+
    `.muted{color:#666}`+
    `</style></head><body>`+
    `<div class="wrap">`+
    `<h1>授权验证</h1>`+
    `<div class="box">`+
    `<p class="muted">请上传授权文件（license.lic）。如未获得授权，请复制下方机器码并发送给管理员。</p>`+
    `<div class="row"><strong>机器码：</strong><code id="hwid">-</code><button id="copy">复制</button></div>`+
    `<div class="row" style="margin-top:8px"><button id="pick">选择授权文件</button><button id="open">打开授权目录</button><button id="check">重新校验</button></div>`+
    `<p id="status" class="muted">待校验…</p>`+
    `<div class="row" style="margin-top:8px"><button id="launch" class="primary" disabled>进入应用</button></div>`+
    `</div></div>`+
    `<script>`+
    `const $=(s)=>document.querySelector(s);`+
    `async function call(name){ const r = await fetch('toonflow://'+name); return r.json(); }`+
    `async function refresh(){ const st = await call('licensestatus'); const el=$('#status'); if(st.ok){ el.textContent='授权有效，到期时间：'+(st.payload?.exp||''); $('#launch').disabled=false; } else { el.textContent='未通过：'+(st.reason||'未知原因'); $('#launch').disabled=true; } }`+
    `async function init(){ const id = await call('machineid'); $('#hwid').textContent=id.hwid||'-'; await refresh(); }`+
    `$('#copy').onclick=()=>{ navigator.clipboard.writeText($('#hwid').textContent); };`+
    `$('#pick').onclick=async()=>{ await call('licensepick'); await refresh(); };`+
    `$('#open').onclick=()=>{ call('licenseopenfolder'); };`+
    `$('#check').onclick=refresh;`+
    `$('#launch').onclick=async()=>{ const r=await call('licenselaunch'); if(!r.ok) alert('仍未通过：'+(r.reason||'')); };`+
    `init();`+
    `</script>`+
    `</body></html>`)}
  `;
  licenseWindow = new BrowserWindow({
    width: 720,
    height: 420,
    resizable: false,
    show: true,
    autoHideMenuBar: true,
    title: '授权验证',
    backgroundColor: '#ffffff',
  });
  licenseWindow.on('closed', () => {
    licenseWindow = null;
    if (!isAuthorized) app.exit(0);
  });
  void licenseWindow.loadURL(html);
}
function getServeDir(): string {
  return getPath(['serve']);
}
async function startBackend(): Promise<void> {
  if (app.isPackaged) {
    await new Promise((r) => setTimeout(r, 0));
    initializeData();
    const serverPath = path.join(getServeDir(), 'app.js');
    const mod = requireWithCustomPaths(serverPath);
    closeServeFn = mod.closeServe;
    const port: number | string = await mod.default(true);
    process.env.PORT = String(port);
  } else {
    const serverPath = path.join(process.cwd(), 'src', 'app.ts');
    const mod = requireWithCustomPaths(serverPath);
    closeServeFn = mod.closeServe;
    const port: number | string = await mod.default(true);
    process.env.PORT = String(port);
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 1200));
}
protocol.registerSchemesAsPrivileged([
  {
    scheme: "toonflow",
    privileges: {
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
app.whenReady().then(async () => {
  // 立即显示 loading 窗口
  showLoading();
  try {
    if (app.isPackaged) {
      // Ensure runtime data directories/files exist even before authorization.
      initializeData();
    }
    try { const fp = path.join(getServeDir(), "boot_debug.log"); fs.mkdirSync(getServeDir(), { recursive: true }); fs.appendFileSync(fp, JSON.stringify({ ts: new Date().toISOString(), step: "app.whenReady" })+"\n", { encoding: "utf8" }); } catch {}
    // 注册 toonflow 协议处理（包含窗口控制 + 许可相关）
    protocol.handle("toonflow", (request) => { try { const fp = path.join(getServeDir(), "boot_debug.log"); fs.appendFileSync(fp, JSON.stringify({ ts: new Date().toISOString(), step: "protocol.handle" })+"\n", { encoding: "utf8" }); } catch {}
      const url = new URL(request.url);
      const pathname = url.hostname.toLowerCase();
      const handlers: Record<string, () => object> = {
        opendevtool: () => { try { mainWindow?.webContents.openDevTools({ mode: "detach" }); } catch {} return { ok: true }; },
        opendevtools: () => { try { mainWindow?.webContents.openDevTools({ mode: "detach" }); } catch {} return { ok: true }; },
        // —— 许可相关 ——
        machineid: () => ({ hwid: getMachineId() }),
        licensestatus: () => verifyFromDisk(),
        licensepick: () => {
          const dir = getServeDir();
          fs.mkdirSync(dir, { recursive: true });
          const res = dialog.showOpenDialogSync({ properties: ["openFile"], filters: [{ name: "License", extensions: ["lic", "json", "pem"] }] });
          if (res && res[0]) {
            const to = path.join(dir, "license.lic");
            fs.copyFileSync(res[0], to);

            try {
            } catch {}
            return { ok: true, path: to };
          }
          return { ok: false, canceled: true };
        },
        licenseopenfolder: () => { fs.mkdirSync(getServeDir(), { recursive: true }); shell.openPath(getServeDir());
          return { ok: true };
        },
        licenselaunch: () => {
          const st2 = verifyFromDisk();
          if (!st2.ok) return st2;
          isAuthorized = true;
          startBackend()
            .then(() => {
              if (licenseWindow && !licenseWindow.isDestroyed()) licenseWindow.close();
              void createMainWindow();
            })
            .catch((e) => { console.error('[backend start failed]', e); });
          return { ok: true };
        },
        // —— 窗口控制 ——
        getappurl: () => ({ url: process.env.URL ?? (process.env.PORT ? `http://localhost:${process.env.PORT}/api` : "") }),
        windowminimize: () => { mainWindow?.minimize(); return { ok: true }; },
        windowmaximize: () => { if (mainWindow?.isMaximized()) { mainWindow.unmaximize(); } else { mainWindow?.maximize(); } return { ok: true }; },
        windowclose: () => { app.exit(0); return { ok: true }; },
        apprestart: () => { setTimeout(() => { app.relaunch(); app.exit(0); }, 500); return { ok: true, message: '应用将重启' }; },
        windowismaximized: () => ({ maximized: mainWindow?.isMaximized() ?? false }),
        uiready: () => { uiReadyFlag = true; tryShowMainWindow(); return { ok: true }; },
        uistate: () => { try { const url = new URL(request.url); const d = Object.fromEntries(url.searchParams.entries()); const fp = path.join(getServeDir(), "ui_debug.log"); fs.appendFileSync(fp, JSON.stringify({ ts: new Date().toISOString(), type: "uistate", data: d })+"\n", { encoding: "utf8" }); } catch {} return { ok: true }; },
        openurlwithbrowser: () => {
          const search = url.searchParams;
          const targetUrl = search.get('url');
          if (targetUrl) { shell.openExternal(targetUrl); return { ok: true }; }
          return { ok: false, error: '缺少url参数' };
        },
      };
      const handler = handlers[pathname];
      const responseData = handler ? handler() : { error: '未知接口' };
      return new Response(JSON.stringify(responseData), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    });
    // —— 启动流程：先验证许可 ——
    const st = verifyFromDisk();
    if (st.ok) {
      try { const fp = path.join(getServeDir(), "boot_debug.log"); fs.appendFileSync(fp, JSON.stringify({ ts: new Date().toISOString(), step: "startBackend" })+"\n", { encoding: "utf8" }); } catch {}
      await startBackend();
      isAuthorized = true;
      await createMainWindow();
    } else {
      closeLoading();
      createLicenseWindow();
    }
  } catch (err) {
    console.error('[服务启动失败]:', err);
    createLicenseWindow();
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
app.on("before-quit", async (event) => {
  if (closeServeFn) await closeServeFn();
});




