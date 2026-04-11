# julongAI 运维手册（OPS）

本文说明如何打包、生成/续期授权、验证授权与常见排障。

- 签名方案：ECDSA P-256 + SHA-256
- 许可证格式：JSON（规范化排序后签名），字段：`sub`、`exp`、`hwid`、`ver`、`features`、`sig`
- 客户端放置：`<用户数据目录>/license.lic`（应用会引导导入）
- 公钥位置（随包分发）：`data/serve/license_public.pem`

## 1. 打包发布

1) 确认公钥
- 生成密钥对后，将 `keys/public.pem` 的内容复制到仓库的 `data/serve/license_public.pem`。
- 注意：`license_public.pem` 必须是 ECDSA P-256 公钥（PEM，SPKI）。

2) 构建与打包
- 开发预览（可触发授权窗口导入）：
  - `yarn dev:gui` 或 `yarn dev:gui-vite`
- 构建服务与主进程：
  - `yarn build`
- 生成安装包：
  - 全平台（当前平台可用目标）：`yarn dist`
  - 指定平台：`yarn dist:win` / `yarn dist:mac` / `yarn dist:linux`
- 产物位置：`dist/` 目录

## 2. 生成与发放授权

A. 生成密钥对（离线进行，妥善保管私钥）
```bash
# 仅首次执行
yarn licensegen gen-keypair --out keys
# 生成 keys/private.pem 与 keys/public.pem
# 将 keys/public.pem 复制到 data/serve/license_public.pem（构建前）
```

B. 获取客户机器码（可选绑定）
- 客户端任意时刻按 `Ctrl + Shift + L` 打开“设置-授权”窗口，即可看到机器码；或在控制台执行：
```js
fetch('julongai://getmachineid').then(r => r.json())
```

C. 签发许可证（.lic）
```bash
# 不绑定机器
yarn licensegen issue --priv keys/private.pem --out license.lic \
  --sub "客户/订单" --exp 2027-12-31

# 绑定机器
yarn licensegen issue --priv keys/private.pem --out license.lic \
  --sub "客户/订单" --exp 2027-12-31 --hwid <上一步机器码>
```
- 可选参数：`--features '{"pro":true}'`、`--ver 1`
- 生成的 `license.lic` 发给客户；客户端在提示框导入，或在“设置-授权”页面点击“导入授权文件”。

## 3. 续期（延期）与验证

- 续期：保持 `--hwid` 不变，调整 `--exp` 为新的到期日，重新 `issue` 生成新 `.lic`。
- 客户把新证覆盖导入后，状态会变为“有效”，到期时间更新。
- 验证方式：
  - 打开“设置-授权”页面（快捷键 `Ctrl + Shift + L`），查看“状态/到期时间/授权对象/功能”。
  - 也可在 DevTools Console 查询：
    ```js
    fetch('julongai://getlicenseinfo').then(r=>r.json())
    ```

## 4. 运行时位置与排障

- 授权文件存放：`app.getPath('userData')/license.lic`
  - Windows：`%APPDATA%/julongAI/license.lic`
  - macOS：`~/Library/Application Support/julongAI/license.lic`
  - Linux：`~/.config/julongAI/license.lic`
- 常见错误：
  - “未找到授权文件”：尚未导入 `.lic`。
  - “授权已到期”：重新签发，更新 `--exp`。
  - “机器码不匹配”：检查是否绑定正确机器码或重新签发。
  - “签名验签失败”：公钥不一致或文件被损坏；确认 `data/serve/license_public.pem` 与发行方私钥匹配。

## 5. 安全建议

- 私钥仅在离线安全环境保存与使用；不要提交到仓库，也不要放入客户端。
- 公钥可以随包分发；如需轮换，更新 `data/serve/license_public.pem` 并重新打包。
- 如需防时间回拨与更强对抗，可在后续版本启用“高水位线”与多点校验（可选）。

