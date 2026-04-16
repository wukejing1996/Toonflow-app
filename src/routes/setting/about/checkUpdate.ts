import express from "express";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
const router = express.Router();

import fs from "fs";
import path from "path";

declare const __APP_VERSION__: string | undefined;

const APP_VERSION: string = (() => {
  if (typeof __APP_VERSION__ !== "undefined") {
    return __APP_VERSION__;
  }
  // 开发环境回退：从 package.json 读取
  const pkgPath = path.resolve(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  return pkg.version;
})();

export default router.post(
  "/",
  validateFields({
    source: z.enum(["toonflow", "github", "gitee", "atomgit"]),
    url: z.url().nullable().optional(),
  }),
  async (req, res) => {
    // 永远不自动检查更新：对客户端保持“无感知”，始终返回无需更新。
    // 这样即使前端在启动时调用该接口，也不会产生任何联网请求或更新提示。
    void req.body;
    const time = new Date().toISOString();
    return res.status(200).send(success({ needUpdate: false, latestVersion: APP_VERSION, reinstall: false, time, version: APP_VERSION }));
  },
);
