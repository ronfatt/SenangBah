import express from "express";
import OpenAI from "openai";
import { nanoid } from "nanoid";
import { run, get, all } from "../db.js";
import { nowIso } from "../utils.js";
import { pilotIntroAnalysisSchemaWrapper } from "../schema.js";

const router = express.Router();
const PILOT_LIMIT = 100;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const INTRO_ANALYSIS_SYSTEM = `You are an SPM English writing tutor.
Analyze a short self-introduction essay from a student.
Give practical, friendly feedback.
Return valid JSON only with:
- strengths (2-3)
- weaknesses (2-3)
- grammar (2-3)
- sentence_fixes (exactly 3 items with original, improved, reason)
- overall_comment (1 short paragraph)
- scores: clarity, grammar, idea, vocabulary (0-100)

Rules:
- Keep language simple for teens.
- Keep "original" as short quoted sentences copied from the student text.
- If the text is too short, still give best-effort feedback and mark missing detail in weaknesses.`;

function clean(value) {
  return String(value || "").trim();
}

function fallbackAnalysis() {
  return {
    strengths: ["Your submission is complete and clear enough for review."],
    weaknesses: ["AI analysis is temporarily unavailable. Please try again later."],
    grammar: ["We could not process grammar checks now."],
    sentence_fixes: [],
    overall_comment:
      "We received your writing sample. Our team will still review your application.",
    scores: {
      clarity: 55,
      grammar: 55,
      idea: 55,
      vocabulary: 55
    }
  };
}

async function analyzeIntro({ role, intro }) {
  if (!process.env.OPENAI_API_KEY) return fallbackAnalysis();

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: INTRO_ANALYSIS_SYSTEM },
        {
          role: "user",
          content:
            `Applicant role: ${role}\n` +
            `Essay:\n${intro}`
        }
      ],
      response_format: { type: "json_schema", json_schema: pilotIntroAnalysisSchemaWrapper }
    });
    return JSON.parse(response?.choices?.[0]?.message?.content || "{}");
  } catch {
    return fallbackAnalysis();
  }
}

router.get("/meta", async (_req, res) => {
  const row = await get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) AS under_review,
            SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approved
     FROM pilot_registrations`
  );

  const total = Number(row?.total || 0);
  const underReview = Number(row?.under_review || 0);
  const approved = Number(row?.approved || 0);

  res.json({
    total_applications: total,
    review_pool_count: underReview,
    pilot_limit: PILOT_LIMIT,
    approved_count: approved,
    seats_left: Math.max(PILOT_LIMIT - approved, 0)
  });
});

router.get("/examples", async (_req, res) => {
  const rows = await all(
    `SELECT id, sort_order, before_text, after_text
     FROM register_examples
     ORDER BY sort_order ASC, id ASC`
  );
  res.json({ items: rows });
});

router.post("/diagnose", async (req, res) => {
  const cleanRole = clean(req.body?.role).toLowerCase() || "student";
  const cleanIntro = clean(req.body?.self_intro_text);

  if (!cleanIntro) return res.status(400).json({ error: "missing_intro" });
  if (cleanIntro.split(/\s+/).length < 30) {
    return res.status(400).json({ error: "intro_too_short" });
  }

  const analysis = await analyzeIntro({ role: cleanRole, intro: cleanIntro });
  res.json({ ok: true, intro_analysis: analysis });
});

router.post("/submit", async (req, res) => {
  const {
    role,
    full_name,
    age,
    school_name,
    email,
    phone,
    address,
    self_intro_text,
    self_intro_analysis,
    plan_choice
  } = req.body || {};

  const cleanRole = clean(role).toLowerCase();
  const cleanName = clean(full_name);
  const cleanSchool = clean(school_name);
  const cleanEmail = clean(email).toLowerCase();
  const cleanPhone = clean(phone);
  const cleanAddress = clean(address);
  const cleanIntro = clean(self_intro_text);
  const cleanPlan = clean(plan_choice).toLowerCase();
  const numericAge = Number(age);

  if (!cleanRole || !["student", "parent", "teacher"].includes(cleanRole)) {
    return res.status(400).json({ error: "invalid_role" });
  }

  if (
    !cleanName ||
    !Number.isFinite(numericAge) ||
    numericAge < 13 ||
    numericAge > 25 ||
    !cleanSchool ||
    !cleanEmail ||
    !cleanPhone ||
    !cleanIntro ||
    !cleanPlan
  ) {
    return res.status(400).json({ error: "missing_fields" });
  }

  if (cleanIntro.split(/\s+/).length < 30) {
    return res.status(400).json({ error: "intro_too_short" });
  }

  if (!["one_to_one", "ai_assisted"].includes(cleanPlan)) {
    return res.status(400).json({ error: "invalid_plan_choice" });
  }

  if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    return res.status(400).json({ error: "invalid_email" });
  }

  const existing = await get(
    "SELECT id FROM pilot_registrations WHERE email = ? ORDER BY created_at DESC LIMIT 1",
    [cleanEmail]
  );
  if (existing) {
    return res.status(409).json({ error: "email_already_registered" });
  }

  const status = "UNDER_REVIEW";

  let introAnalysis = null;
  if (self_intro_analysis && typeof self_intro_analysis === "object") {
    introAnalysis = self_intro_analysis;
  } else {
    introAnalysis = await analyzeIntro({ role: cleanRole, intro: cleanIntro });
  }

  const id = nanoid();
  await run(
    `INSERT INTO pilot_registrations
      (id, role, full_name, age, school_name, email, phone, address, previous_result_type, previous_result, self_intro_text, self_intro_analysis_json, plan_choice, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      cleanRole,
      cleanName,
      numericAge,
      cleanSchool,
      cleanEmail,
      cleanPhone,
      cleanAddress,
      "ai_diagnostic",
      "Self-introduction diagnostic",
      cleanIntro,
      JSON.stringify(introAnalysis),
      cleanPlan,
      status,
      nowIso()
    ]
  );

  res.json({
    ok: true,
    application_id: id,
    status,
    intro_analysis: introAnalysis,
    message: "Application received and added to the review pool. We will contact you after screening."
  });
});

export default router;
