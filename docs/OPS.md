# OPS（授权与发放）

本文档用于说明 `julongAI` 的授权文件发放流程。

目标：所有用户安装 **同一个安装包**（内置同一份公钥 `license_public.pem`），管理员根据每个用户的机器码（HWID）签发 `license.lic`，用户把 `license.lic` 放到指定目录后即可通过校验。

## 文件说明

- `keys/private.pem`
  - **管理员私钥**（用于签发授权）
  - 绝对不能发给用户
  - 建议只保存在管理员机器/安全介质中

- `data/serve/license_public.pem`
  - **公钥**（随安装包发布，所有用户共用同一份）
  - 需要提交到仓库，保证打包时会被带进安装包

- `license.lic`
  - 用户授权文件（每个 HWID 不同/过期时间不同）
  - 由管理员发给用户

## 一次性初始化（管理员）

1) 生成密钥对（只需要做一次）

```bash
yarn licensegen gen-keypair --out ./keys
```

生成：

- `keys/private.pem`（私钥，仅管理员保存）
- `keys/public.pem`（公钥源文件）

2) 同步公钥到应用资源目录（需要提交）

```bash
yarn licensegen sync-public --pub ./keys/public.pem
```

默认会写入：

- `data/serve/license_public.pem`

确认该文件已被 Git 跟踪（不要放在 `.gitignore` 里）。

## 签发授权（管理员）

给某个机器码签发授权：

```bash
yarn licensegen issue \
  --priv ./keys/private.pem \
  --dir ./licenses \
  --out license.lic \
  --exp 2026-04-30 \
  --hwid 35143508-49c3-4dcf-b6b4-95b3fae238d2
```

输出固定按 HWID 分目录存放：

- `licenses/<hwid>/license.lic`

把该 `license.lic` 发给对应用户即可。

## 用户侧放置位置

应用启动时会从以下位置查找授权文件（按顺序）：

1) 用户数据目录：`<userData>/data/serve/license.lic`
2) 开发调试兜底：`./license.lic`（仅开发环境建议）

公钥文件会从以下位置查找（按顺序）：

1) 用户数据目录：`<userData>/data/serve/license_public.pem`
2) 安装包资源目录：`resources/data/serve/license_public.pem`
3) 开发调试兜底：`./keys/public.pem`

正常发版场景：安装包自带 `license_public.pem`，用户只需要放入 `license.lic`。

## 常见问题

### 1) 为什么需要 `private.pem` / `public.pem`？

这是非对称签名方案：

- 管理员使用 `private.pem` 对授权内容（到期时间、HWID 等）进行签名
- 客户端只需要 `public.pem` 就能验证签名真伪

因此：

- **私钥必须保密**，泄露后任何人都能伪造授权
- **公钥可以公开**，内置在安装包里用于验签

### 2) 为什么所有用户可以共用一个安装包？

因为安装包只包含公钥（用于验签），不包含私钥。
不同用户的差异只体现在你发放给他们的 `license.lic`。

