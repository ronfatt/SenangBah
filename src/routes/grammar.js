import express from "express";
import { nanoid } from "nanoid";
import { requireAuth } from "../middleware/auth.js";
import { get, run } from "../db.js";
import { nowIso, todayKey } from "../utils.js";
import { runMode } from "../orchestrator.js";

const router = express.Router();

const GRAMMAR_BANK = [
  {
    rule: "subject_verb",
    title: "Fix the verb",
    weak: "She go to school every day.",
    fix_hint: "Change the verb to match the subject.",
    better: "She goes to school every day.",
    pattern: "Simple present (he/she/it + s)"
  },
  {
    rule: "article",
    title: "Add the article",
    weak: "He has idea about the topic.",
    fix_hint: "Add the right article.",
    better: "He has an idea about the topic.",
    pattern: "a / an before singular noun"
  },
  {
    rule: "connector",
    title: "Make it flow",
    weak: "It is useful. It can save time.",
    fix_hint: "Join with a connector.",
    better: "It is useful because it can save time.",
    pattern: "because / so / although"
  }
];

function pickGrammarForToday() {
  const date = new Date();
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const day = Math.floor(diff / 86400000);
  return GRAMMAR_BANK[day % GRAMMAR_BANK.length];
}

function buildContext({ mode, user, session, studentAnswer }) {
  const info = JSON.parse(session.grammar_info || "{}");
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
      theme: "Grammar",
      skill: "sentence_control",
      micro_goal: `Fix one weak sentence using: ${info.pattern || "simple fix"}`
    },
    content: {
      weak_sentence: info.weak,
      better_sentence: info.better,
      hint: info.fix_hint,
      constraints: { time_minutes: 6, word_limit: 20 },
      student_answer: studentAnswer || ""
    },
    history: {
      last_7_days_skills: ["sentence_control"],
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
    `INSERT INTO grammar_responses (id, session_id, step, prompt_json, model_json, student_answer, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)` ,
    [id, sessionId, step, JSON.stringify(promptJson), JSON.stringify(modelJson), null, nowIso()]
  );
  return id;
}

router.post("/start", requireAuth, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const date = todayKey();
  let session = await get("SELECT * FROM grammar_sessions WHERE user_id = ? AND date = ?", [user.id, date]);

  if (!session) {
    const info = pickGrammarForToday();
    const sessionId = nanoid();
    await run(
      `INSERT INTO grammar_sessions (id, user_id, date, current_step, grammar_info, created_at)
       VALUES (?, ?, ?, ?, ?, ?)` ,
      [sessionId, user.id, date, "grammar_warmup", JSON.stringify(info), nowIso()]
    );
    session = await get("SELECT * FROM grammar_sessions WHERE id = ?", [sessionId]);
  }

  const currentStep = session.current_step;
  if (currentStep === "done") return res.json({ session_id: session.id, done: true });

  const lastResponse = await get(
    `SELECT * FROM grammar_responses WHERE session_id = ? AND step = ? ORDER BY created_at DESC LIMIT 1`,
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

  const session = await get("SELECT * FROM grammar_sessions WHERE id = ? AND user_id = ?", [session_id, user.id]);
  if (!session) return res.status(404).json({ error: "session_not_found" });
  if (session.current_step !== step) return res.status(400).json({ error: "step_mismatch" });

  await run(
    `UPDATE grammar_responses SET student_answer = ? WHERE id = (
       SELECT id FROM grammar_responses WHERE session_id = ? AND step = ? ORDER BY created_at DESC LIMIT 1
     )`,
    [student_answer || "", session.id, step]
  );

  const order = ["grammar_warmup", "grammar_fix", "grammar_reinforce"];
  const idx = order.indexOf(step);
  if (idx === -1) return res.status(400).json({ error: "invalid_step" });

  if (idx === order.length - 1) {
    await run("UPDATE grammar_sessions SET current_step = ? WHERE id = ?", ["done", session.id]);
    return res.json({ session_id: session.id, done: true });
  }

  const nextStep = order[idx + 1];
  const context = buildContext({ mode: nextStep, user, session, studentAnswer: "" });
  const data = await runMode(nextStep, context);
  await createResponseRow(session.id, nextStep, context, data);
  await run("UPDATE grammar_sessions SET current_step = ? WHERE id = ?", [nextStep, session.id]);

  return res.json({ session_id: session.id, step: nextStep, data, done: false });
});

export default router;
