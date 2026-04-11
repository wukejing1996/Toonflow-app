import express from "express";
import { success } from "@/lib/responseFormat";
import { getMachineId } from "@/utils/license";

const router = express.Router();

export default router.get("/", async (_req, res) => {
  const hwid = getMachineId();
  res.status(200).send(success({ hwid }));
});