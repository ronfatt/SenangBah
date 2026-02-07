import express from "express";
import { nanoid } from "nanoid";
import { requireAuth } from "../middleware/auth.js";
import { get, run } from "../db.js";
import { nowIso, todayKey } from "../utils.js";
import { runMode } from "../orchestrator.js";

const router = express.Router();

const WEEKLY_FOCUS = {
  theme: "Education",
  skill: "idea_development",
  micro_goal: "Write a clear Part 2 response with 2 strong points"
};

const WEEKLY_CONTENT = {
  question: "",
  student_answer: "",
  reference_text: "",
  constraints: {
    time_minutes: 25,
    word_limit: 150
  }
};

const HISTORY = {
  last_7_days_skills: ["topic_sentences", "connectors", "examples"],
  spaced_items_due: ["moreover", "as a result", "for instance"]
};

const UI = { language: "en", tone: "genz_direct", allow_multichoice: false };

function buildWeeklyContext({ user, content, studentAnswer }) {
  return {
    mode: "weekly_checkpoint",
    exam: "SPM",
    paper: "writing",
    target_band: 6,
    student_profile: {
      form: user.form,
      estimated_band: user.estimated_band,
      weaknesses: JSON.parse(user.weaknesses || "[]"),
      strengths: JSON.parse(user.strengths || "[]")
    },
    today_focus: WEEKLY_FOCUS,
    content: {
      ...content,
      student_answer: studentAnswer || ""
    },
    history: HISTORY,
    ui: UI
  };
}

router.post("/start", requireAuth, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const date = todayKey();
  const id = nanoid();
  const content = { ...WEEKLY_CONTENT };
  const context = buildWeeklyContext({ user, content, studentAnswer: "" });

  const data = await runMode("weekly_checkpoint", context);
  const question = data?.items?.[0]?.prompt || "SPM Writing Part 2 question";
  content.question = question;

  await run(
    `INSERT INTO weekly_checkpoints (id, user_id, date, prompt_json, student_answer, feedback_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, user.id, date, JSON.stringify(data), null, null, nowIso()]
  );

  res.json({ checkpoint_id: id, data });
});

router.post("/submit", requireAuth, async (req, res) => {
  const { checkpoint_id, student_answer } = req.body || {};
  if (!checkpoint_id) return res.status(400).json({ error: "missing_fields" });

  const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const checkpoint = await get(
    "SELECT * FROM weekly_checkpoints WHERE id = ? AND user_id = ?",
    [checkpoint_id, user.id]
  );
  if (!checkpoint) return res.status(404).json({ error: "checkpoint_not_found" });

  const promptJson = JSON.parse(checkpoint.prompt_json || "{}");
  const question = promptJson?.items?.[0]?.prompt || "SPM Writing Part 2 question";

  const content = { ...WEEKLY_CONTENT, question };
  const context = buildWeeklyContext({ user, content, studentAnswer: student_answer || "" });

  const feedback = await runMode("weekly_checkpoint", context);

  await run(
    `UPDATE weekly_checkpoints SET student_answer = ?, feedback_json = ? WHERE id = ?`,
    [student_answer || "", JSON.stringify(feedback), checkpoint_id]
  );

  res.json({ data: feedback });
});

export default router;
