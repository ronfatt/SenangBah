import express from "express";
import OpenAI from "openai";
import { requireAuth } from "../middleware/auth.js";
import { chatSchemaWrapper } from "../schema.js";

const router = express.Router();
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

router.post("/", requireAuth, async (req, res) => {
  const { question } = req.body || {};
  if (!question || typeof question !== "string" || question.trim().length < 2) {
    return res.json(fallback(""));
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
    return res.json(parsed);
  } catch {
    return res.json(fallback(question.trim()));
  }
});

export default router;
