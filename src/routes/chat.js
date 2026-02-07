import express from "express";
import OpenAI from "openai";
import { requireAuth } from "../middleware/auth.js";
import { chatSchemaWrapper } from "../schema.js";
import { nanoid } from "nanoid";
import { run, get, all } from "../db.js";

const router = express.Router();
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_DAILY_LIMIT = Number(process.env.CHAT_DAILY_LIMIT || 20);
const CHAT_MIN_INTERVAL_MS = Number(process.env.CHAT_MIN_INTERVAL_MS || 5000);

const SYSTEM = `You are a friendly English teacher for Malaysia SPM students.
If the student's question is in Malay, respond in Malay.
If in Chinese, respond in Chinese.
If in English, respond in English.
Always include an English version of their question in the field "english_question".
Keep answers short, teen-friendly, and practical. No grammar jargon unless asked.
Provide one short improvement tip in "quick_tip".`;

function fallback(question) {
  return {
    answer: "Ask me any English question. Keep it to one sentence.",
    english_question: question ? `How can I ask: ${question}` : "How do I say this in English?",
    quick_tip: "Keep your question short and clear."
  };
}

const lastAskAt = new Map();

function tooSoon(userId) {
  const now = Date.now();
  const last = lastAskAt.get(userId) || 0;
  if (now - last < CHAT_MIN_INTERVAL_MS) return true;
  lastAskAt.set(userId, now);
  return false;
}

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function countToday(userId) {
  const since = startOfTodayISO();
  const row = await get(
    `SELECT COUNT(*) as cnt FROM chat_messages WHERE user_id = ? AND created_at >= ?`,
    [userId, since]
  );
  return Number(row?.cnt || 0);
}

router.post("/", requireAuth, async (req, res) => {
  const { question } = req.body || {};
  if (!question || typeof question !== "string" || question.trim().length < 2) {
    return res.json(fallback(""));
  }

  if (tooSoon(req.user.id)) {
    return res.status(429).json({ error: "slow_down", message: "Please wait a few seconds." });
  }

  const todayCount = await countToday(req.user.id);
  if (todayCount >= CHAT_DAILY_LIMIT) {
    return res.status(429).json({ error: "limit_reached", message: "Daily chat limit reached." });
  }

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: question.trim() }
      ],
      response_format: { type: "json_schema", json_schema: chatSchemaWrapper }
    });

    const text = response?.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(text);

    await run(
      `INSERT INTO chat_messages (id, user_id, question, answer, english_question, quick_tip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        nanoid(),
        req.user.id,
        question.trim(),
        parsed.answer || "",
        parsed.english_question || "",
        parsed.quick_tip || "",
        new Date().toISOString()
      ]
    );

    return res.json(parsed);
  } catch {
    return res.json(fallback(question.trim()));
  }
});

router.get("/history", requireAuth, async (req, res) => {
  const rows = await all(
    `SELECT question, answer, english_question, quick_tip, created_at
     FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
    [req.user.id]
  );
  res.json({ items: rows.reverse() });
});

router.get("/suggestions", requireAuth, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
  const weaknesses = JSON.parse(user?.weaknesses || "[]");

  const base = [
    "How do I make my sentence clearer?",
    "Give me a stronger verb for this sentence.",
    "How can I add one simple example?"
  ];

  const map = {
    limited_vocab: [
      "What is a better word for 'important'?",
      "Give me 3 simple synonyms for 'good'."
    ],
    sentence_variety: [
      "How do I join two short sentences?",
      "How can I start a sentence with a connector?"
    ],
    idea_development: [
      "How do I add a reason to my point?",
      "Give me one example I can add."
    ]
  };

  const suggestions = [...base];
  weaknesses.forEach((w) => {
    if (map[w]) suggestions.push(...map[w]);
  });

  const unique = Array.from(new Set(suggestions)).slice(0, 6);
  res.json({ suggestions: unique });
});

export default router;
