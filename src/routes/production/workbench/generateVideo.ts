import express from "express";
import u from "@/utils";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import axios from "axios";
import crypto from "node:crypto";
import fs from "node:fs/promises";
const router = express.Router();

type Type = "imageReference" | "startImage" | "endImage" | "videoReference" | "audioReference";
interface UploadItem {
  fileType: "image" | "video" | "audio";
  type: Type;
  sources?: "assets" | "storyboard";
  id?: number;
  src?: string;
  label?: string;
  prompt?: string;
}

type TosConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  securityToken?: string;
  keyPrefix?: string;
  signedUrlExpires?: number;
};

async function loadTosConfig(): Promise<TosConfig | null> {
  // 支持用配置文件方式加载：data/tos.json（UTF-8）
  const configPath = u.getPath("tos.json");
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<TosConfig>;
    if (!parsed.endpoint || !parsed.region || !parsed.bucket || !parsed.accessKeyId || !parsed.secretAccessKey) return null;
    return parsed as TosConfig;
  } catch {
    return null;
  }
}

function sha256Hex(data: string) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, data: string) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeUriPath(pathname: string) {
  return pathname
    .split("/")
    .map((p) => encodeRfc3986(p))
    .join("/");
}

function toTosDate(dt: Date) {
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const hh = String(dt.getUTCHours()).padStart(2, "0");
  const mi = String(dt.getUTCMinutes()).padStart(2, "0");
  const ss = String(dt.getUTCSeconds()).padStart(2, "0");
  const dateStamp = `${yyyy}${mm}${dd}`;
  const tosDate = `${dateStamp}T${hh}${mi}${ss}Z`;
  return { dateStamp, tosDate };
}

function toCanonicalQueryString(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(params[k])}`)
    .join("&");
}

function normalizeTosEndpoint(endpoint: string) {
  return endpoint.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function getTosSigningKey(secretKey: string, dateStamp: string, region: string) {
  // TOS4-HMAC-SHA256: HMAC(HMAC(HMAC(HMAC(SK, Date), Region), "tos"), "request")
  const kDate = hmacSha256(secretKey, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, "tos");
  const kSigning = hmacSha256(kService, "request");
  return kSigning;
}

function createTosPresignedUrl(input: {
  method: "GET" | "PUT";
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  securityToken?: string;
  key: string;
  expiresSeconds: number;
}) {
  const dt = new Date();
  const { dateStamp, tosDate } = toTosDate(dt);

  const host = `${input.bucket}.${normalizeTosEndpoint(input.endpoint)}`;
  const canonicalUri = `/${encodeUriPath(input.key.replace(/^\/+/, ""))}`;

  const credentialScope = `${dateStamp}/${input.region}/tos/request`;
  const credential = `${input.accessKeyId}/${credentialScope}`;

  const queryParams: Record<string, string> = {
    "X-Tos-Algorithm": "TOS4-HMAC-SHA256",
    "X-Tos-Credential": credential,
    "X-Tos-Date": tosDate,
    "X-Tos-Expires": String(input.expiresSeconds),
    "X-Tos-SignedHeaders": "host",
  };
  if (input.securityToken) {
    queryParams["X-Tos-Security-Token"] = input.securityToken;
  }

  const canonicalQueryString = toCanonicalQueryString(queryParams);
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";

  const canonicalRequest = [
    input.method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "TOS4-HMAC-SHA256",
    tosDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = getTosSigningKey(input.secretAccessKey, dateStamp, input.region);
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  const finalQueryString = `${canonicalQueryString}&X-Tos-Signature=${signature}`;
  return `https://${host}${canonicalUri}?${finalQueryString}`;
}

function guessMediaTypeByPath(filePath: string): "image" | "video" | "audio" {
  const ext = filePath.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  if (ext === "mp4" || ext === "webm") return "video";
  if (ext === "mp3" || ext === "wav") return "audio";
  return "image";
}

function guessContentType(filePath: string, mediaType: "video" | "audio") {
  const ext = filePath.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  if (mediaType === "video") {
    if (ext === "webm") return "video/webm";
    return "video/mp4";
  }
  if (ext === "wav") return "audio/wav";
  return "audio/mpeg";
}

function guessExt(filePath: string, mediaType: "video" | "audio") {
  const ext = filePath.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  if (mediaType === "video") {
    if (ext === "webm") return ".webm";
    return ".mp4";
  }
  if (ext === "wav") return ".wav";
  if (ext === "mp3") return ".mp3";
  return ".mp3";
}

export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
    scriptId: z.number(),
    uploadData: z.array(
      z.object({
        id: z.number(),
        sources: z.string(),
      }),
    ),
    prompt: z.string(),
    model: z.string(),
    mode: z.string(),
    resolution: z.string(),
    duration: z.number(),
    audio: z.boolean().optional(),
    trackId: z.number(),
  }),
  async (req, res) => {
    const { scriptId, projectId, prompt, uploadData, model, duration, resolution, audio, mode, trackId } = req.body;
    let modeData = [];
    if (Array.isArray(mode)) {
    } else if (typeof mode === "string" && mode.startsWith('["') && mode.endsWith('"]')) {
      try {
        modeData = JSON.parse(mode);
      } catch (e) { }
    }
    //获取生成视频比例
    const ratio = await u.db("o_project").select("videoRatio").where("id", projectId).first();
    const videoPath = `/${projectId}/video/${uuidv4()}.mp4`; //视频保存路径

    //新增
    const [videoId] = await u.db("o_video").insert({
      filePath: videoPath,
      time: Date.now(),
      state: "生成中",
      scriptId,
      projectId,
      videoTrackId: trackId,
    });
    res.status(200).send(success(videoId));
    (async () => {
      try {
        const relatedObjects = {
          projectId,
          videoId,
          scriptId,
          type: "视频",
        };

        // 根据用户选择的素材，生成 Seedance 所需的 referenceList：
        // - 图片：仍然使用 DataURL(base64)
        // - 视频/音频：必须是可访问的公网 URL（这里用 TOS 预签名 URL）
        const resolved = await Promise.all(
          uploadData.map(async (item: UploadItem) => {
            if (typeof item?.id !== "number") return null;
            if (item.sources === "storyboard") {
              const row = await u.db("o_storyboard").where("id", item.id).select("filePath").first();
              if (!row?.filePath) return null;
              return { filePath: row.filePath as string, fileType: "image" as const };
            }
            if (item.sources === "assets") {
              const row = (await u
                .db("o_assets")
                .where("o_assets.id", item.id)
                .leftJoin("o_image", "o_assets.imageId", "o_image.id")
                .select("o_image.filePath as filePath", "o_assets.type as assetsType")
                .first()) as any;
              if (!row?.filePath) return null;
              const assetsType = String(row.assetsType ?? "");
              const inferredFileType =
                assetsType === "audio" ? "audio" : (guessMediaTypeByPath(row.filePath) as "image" | "video" | "audio");

              // 只把用户在“素材”中选择的视频当作视频处理（用于后续上传 TOS）。
              // 图片仍按原来的方式走 base64(DataURL) 输入，不参与 TOS 上传。
              const fileType =
                item.fileType === "image" || item.fileType === "video" || item.fileType === "audio"
                  ? item.fileType
                  : inferredFileType;
              return { filePath: row.filePath as string, fileType };
            }
            return null;
          }),
        );

        const tosConfig = await loadTosConfig();
        const needTos = resolved.some((r) => r && (r.fileType === "video" || r.fileType === "audio"));
        if (needTos && !tosConfig) {
          throw new Error("Seedance 参考视频/音频必须使用公网 URL，请先配置 data/tos.json（TOS 配置文件）。");
        }

        const referenceList = await Promise.all(
          resolved
            .filter((r): r is { filePath: string; fileType: "image" | "video" | "audio" } => Boolean(r))
            .map(async (r) => {
              if (r.fileType === "image") {
                const imgBase64 = await u.oss.getImageBase64(r.filePath);
                return { type: "image" as const, base64: imgBase64 };
              }

              const mediaType = r.fileType;
              const keyPrefix = (tosConfig!.keyPrefix ?? "toonflow").replace(/^\/+/, "").replace(/\/+$/, "");
              const objectKey = `${keyPrefix}/${projectId}/seedance-reference/${uuidv4()}${guessExt(r.filePath, mediaType)}`;

              const putUrl = createTosPresignedUrl({
                method: "PUT",
                bucket: tosConfig!.bucket,
                endpoint: tosConfig!.endpoint,
                region: tosConfig!.region,
                accessKeyId: tosConfig!.accessKeyId,
                secretAccessKey: tosConfig!.secretAccessKey,
                securityToken: tosConfig!.securityToken,
                key: objectKey,
                expiresSeconds: 900,
              });

              const buf = await u.oss.getFile(r.filePath);
              await axios.put(putUrl, buf, {
                headers: { "Content-Type": guessContentType(r.filePath, mediaType) },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
              });

              const getUrl = createTosPresignedUrl({
                method: "GET",
                bucket: tosConfig!.bucket,
                endpoint: tosConfig!.endpoint,
                region: tosConfig!.region,
                accessKeyId: tosConfig!.accessKeyId,
                secretAccessKey: tosConfig!.secretAccessKey,
                securityToken: tosConfig!.securityToken,
                key: objectKey,
                expiresSeconds: Math.max(60, Number(tosConfig!.signedUrlExpires ?? 7200)),
              });

              return { type: mediaType, base64: getUrl } as const;
            }),
        );

        const aiVideo = u.Ai.Video(model);
        await aiVideo.run(
          {
            prompt,
            referenceList: referenceList.length > 0 ? referenceList : undefined,
            mode: modeData.length > 0 ? modeData : mode,
            duration,
            aspectRatio: (ratio?.videoRatio as "16:9" | "9:16") || "16:9",
            resolution,
            audio,
          },
          {
            projectId,
            taskClass: "视频生成",
            describe: "根据提示词生成视频",
            relatedObjects: JSON.stringify(relatedObjects),
          },
        );
        await aiVideo.save(videoPath);
        await u.db("o_video").where("id", videoId).update({ state: "生成成功" });
      } catch (error: any) {
        await u
          .db("o_video")
          .where("id", videoId)
          .update({
            state: "生成失败",
            errorReason: u.error(error).message,
          });
      }
    })();
  },
);
