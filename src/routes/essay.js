import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import { nanoid } from "nanoid";
import { requireAuth } from "../middleware/auth.js";
import { run, all } from "../db.js";
import { nowIso } from "../utils.js";
import { handwritingSchemaWrapper } from "../schema.js";

const router = express.Router();
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const uploadDir = process.env.UPLOAD_DIR || (process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "uploads")
  : path.join(process.cwd(), "uploads"));

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `${nanoid()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith("image/");
    cb(ok ? null : new Error("invalid_file"), ok);
  }
});

const SYSTEM = `You are an SPM English writing examiner.
You will see a photo of a student's handwritten essay.
First, extract the text as accurately as you can.
Then provide analysis in SIMPLE English (no grammar jargon unless asked).
Give: strengths (2-3), weaknesses (2-3), improvements (2-3), one band lift sentence,
and sentence_corrections (2-3 items with original, revised, reason).
Estimate band range like "Band 4-5".
Also provide short explanations in Chinese (zh) and Malay (ms).
If text is unreadable, say so and ask for a clearer photo in extracted_text, and keep analysis minimal.`;

router.post("/upload", requireAuth, upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no_file" });

  try {
    const imgBuffer = fs.readFileSync(req.file.path);
    const base64 = imgBuffer.toString("base64");
    const mime = req.file.mimetype || "image/jpeg";
    const dataUrl = `data:${mime};base64,${base64}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: [
          { type: "text", text: "Please analyze this handwritten SPM essay." },
          { type: "image_url", image_url: { url: dataUrl } }
        ] }
      ],
      response_format: { type: "json_schema", json_schema: handwritingSchemaWrapper }
    });

    const text = response?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(text);

    const id = nanoid();
    const publicPath = `/uploads/${path.basename(req.file.path)}`;

    await run(
      `INSERT INTO essay_uploads (id, user_id, file_path, original_name, extracted_text, analysis_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [
        id,
        req.user.id,
        publicPath,
        req.file.originalname,
        parsed.extracted_text || "",
        JSON.stringify(parsed),
        nowIso()
      ]
    );

    res.json({ id, file_path: publicPath, analysis: parsed });
  } catch (e) {
    res.status(500).json({ error: "analysis_failed" });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  const rows = await all(
    `SELECT id, file_path, original_name, extracted_text, analysis_json, created_at
     FROM essay_uploads WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
    [req.user.id]
  );
  const items = rows.map((r) => ({
    id: r.id,
    file_path: r.file_path,
    original_name: r.original_name,
    extracted_text: r.extracted_text,
    analysis: JSON.parse(r.analysis_json || "{}"),
    created_at: r.created_at
  }));
  res.json({ items });
});

export default router;
