import express from "express";
import z from "zod";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";
import fs from "fs";
import axios from "axios";
import compressing from "compressing";
import { success } from "@/lib/responseFormat";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    url: z.url(),
    reinstall: z.boolean(),
    version: z.string(),
  }),
  async (req, res) => {
    // 永远不自动更新：对客户端保持“无感知”。
    // 即使前端误调用该接口，也不会下载或覆盖任何文件。
    void req.body;
    return res.status(200).send(success("OK"));
  },
);
