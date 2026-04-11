import express from "express";
import { success } from "@/lib/responseFormat";
import { verifyFromDisk } from "@/utils/license";

const router = express.Router();

export default router.get("/", async (_req, res) => {
  const result = verifyFromDisk();
  res.status(200).send(success(result));
});