import express from "express";
import { nanoid } from "nanoid";
import { requireAuth } from "../middleware/auth.js";
import { get, run } from "../db.js";
import { nowIso, todayKey } from "../utils.js";
import { runMode } from "../orchestrator.js";

const router = express.Router();

const VOCAB_BANK = [
  { word: "effective", meaning: "works well and gets results", example: "A short plan can be effective if you follow it.", theme: "Study" },
  { word: "crucial", meaning: "very important", example: "Sleep is crucial for students to focus.", theme: "Health" },
  { word: "benefit", meaning: "a good result", example: "One benefit of technology is faster learning.", theme: "Technology" },
  { word: "drawback", meaning: "a bad result", example: "A drawback of phones is distraction.", theme: "Technology" },
  { word: "encourage", meaning: "to support or push someone", example: "Teachers encourage students to read daily.", theme: "School" },
  { word: "reduce", meaning: "to make less", example: "We should reduce screen time at night.", theme: "Health" },
  { word: "improve", meaning: "to make better", example: "Practice can improve your writing.", theme: "Writing" },
  { word: "valuable", meaning: "very useful or important", example: "Feedback is valuable for progress.", theme: "Learning" },
  { word: "convenient", meaning: "easy to use", example: "Online notes are convenient for revision.", theme: "Study" },
  { word: "harmful", meaning: "causing damage", example: "Too much sugar is harmful to health.", theme: "Health" },
  { word: "responsible", meaning: "shows good control", example: "Be responsible when using social media.", theme: "Social media" },
  { word: "balance", meaning: "a good mix of two sides", example: "Balance study and rest to stay healthy.", theme: "Lifestyle" }
];

function pickWordForToday() {
  const date = new Date();
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const day = Math.floor(diff / 86400000);
  const idx = day % VOCAB_BANK.length;
  return VOCAB_BANK[idx];
}

function buildContext({ mode, user, session, studentAnswer }) {
  const wordInfo = JSON.parse(session.word_info || "{}");
  return {
    mode,
    exam: "SPM",
    paper: "writing",
    target_band: 6,
    student_profile: {
      form: user.form,
      estimated_band: user.estimated_band,
      weaknesses: JSON.parse(user.weaknesses || "[]"),
      strengths: JSON.parse(user.strengths || "[]")
    },
    today_focus: {
      theme: wordInfo.theme || "General",
      skill: "vocabulary",
      micro_goal: `Use the word \"${wordInfo.word}\" in one clear sentence.`
    },
    content: {
      target_word: wordInfo.word,
      word_meaning: wordInfo.meaning,
      example_sentence: wordInfo.example,
      constraints: { time_minutes: 5, word_limit: 15 },
      student_answer: studentAnswer || ""
    },
    history: {
      last_7_days_skills: ["vocabulary"],
      spaced_items_due: []
    },
    ui: {
      language: "en",
      tone: "genz_direct",
      allow_multichoice: true
    }
  };
}

async function createResponseRow(sessionId, step, promptJson, modelJson) {
  const id = nanoid();
  await run(
    `INSERT INTO vocab_responses (id, session_id, step, prompt_json, model_json, student_answer, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)` ,
    [id, sessionId, step, JSON.stringify(promptJson), JSON.stringify(modelJson), null, nowIso()]
  );
  return id;
}

router.post("/start", requireAuth, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const date = todayKey();
  let session = await get("SELECT * FROM vocab_sessions WHERE user_id = ? AND date = ?", [user.id, date]);

  if (!session) {
    const wordInfo = pickWordForToday();
    const sessionId = nanoid();
    await run(
      `INSERT INTO vocab_sessions (id, user_id, date, current_step, target_word, word_info, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [
        sessionId,
        user.id,
        date,
        "vocab_warmup",
        wordInfo.word,
        JSON.stringify(wordInfo),
        nowIso()
      ]
    );
    session = await get("SELECT * FROM vocab_sessions WHERE id = ?", [sessionId]);
  }

  const currentStep = session.current_step;
  if (currentStep === "done") return res.json({ session_id: session.id, done: true });

  const lastResponse = await get(
    `SELECT * FROM vocab_responses WHERE session_id = ? AND step = ? ORDER BY created_at DESC LIMIT 1`,
    [session.id, currentStep]
  );

  if (lastResponse) {
    return res.json({ session_id: session.id, step: currentStep, data: JSON.parse(lastResponse.model_json), done: false });
  }

  const context = buildContext({ mode: currentStep, user, session, studentAnswer: "" });
  const data = await runMode(currentStep, context);
  await createResponseRow(session.id, currentStep, context, data);

  return res.json({ session_id: session.id, step: currentStep, data, done: false });
});

router.post("/next", requireAuth, async (req, res) => {
  const { session_id, step, student_answer } = req.body || {};
  if (!session_id || !step) return res.status(400).json({ error: "missing_fields" });

  const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const session = await get("SELECT * FROM vocab_sessions WHERE id = ? AND user_id = ?", [session_id, user.id]);
  if (!session) return res.status(404).json({ error: "session_not_found" });
  if (session.current_step !== step) return res.status(400).json({ error: "step_mismatch" });

  await run(
    `UPDATE vocab_responses SET student_answer = ? WHERE id = (
       SELECT id FROM vocab_responses WHERE session_id = ? AND step = ? ORDER BY created_at DESC LIMIT 1
     )`,
    [student_answer || "", session.id, step]
  );

  const order = ["vocab_warmup", "vocab_apply", "vocab_reinforce"];
  const idx = order.indexOf(step);
  if (idx === -1) return res.status(400).json({ error: "invalid_step" });

  if (idx === order.length - 1) {
    await run("UPDATE vocab_sessions SET current_step = ? WHERE id = ?", ["done", session.id]);
    return res.json({ session_id: session.id, done: true });
  }

  const nextStep = order[idx + 1];
  const context = buildContext({ mode: nextStep, user, session, studentAnswer: "" });
  const data = await runMode(nextStep, context);
  await createResponseRow(session.id, nextStep, context, data);
  await run("UPDATE vocab_sessions SET current_step = ? WHERE id = ?", [nextStep, session.id]);

  return res.json({ session_id: session.id, step: nextStep, data, done: false });
});

export default router;
