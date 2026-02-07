import express from "express";
import { nanoid } from "nanoid";
import { requireAuth } from "../middleware/auth.js";
import { get, run } from "../db.js";
import { nowIso, todayKey } from "../utils.js";
import { runMode } from "../orchestrator.js";

const router = express.Router();

const DEFAULT_TODAY_FOCUS = {
  theme: "Technology",
  skill: "paraphrasing",
  micro_goal: "Upgrade one weak sentence into Band 6 style"
};

const DEFAULT_CONTENT = {
  question: "Your school wants to promote healthy technology use. Write one short paragraph about one benefit and one risk.",
  student_answer: "",
  reference_text:
    "Technology is important in our life. Many students use phones every day. It can help us study because we can search information. But sometimes it wastes time and students play games. The school should tell students to use it well.",
  constraints: {
    time_minutes: 10,
    word_limit: 60
  },
  topic_snapshot: [
    "Most teens use phones for homework and chats every day.",
    "Too much screen time can reduce sleep.",
    "Tech is useful if used with clear rules."
  ],
  angle_choices: ["Benefit", "Risk"],
  band6_move: "Add 1 specific example (e.g., homework, sleep, distraction)."
};

const DEFAULT_HISTORY = {
  last_7_days_skills: ["topic_sentences", "connectors"],
  spaced_items_due: ["however", "in addition", "the main reason is"]
};

const DEFAULT_UI = {
  language: "en",
  tone: "genz_direct",
  allow_multichoice: true
};

function buildContext({ mode, user, session, studentAnswer }) {
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
    today_focus: JSON.parse(session.today_focus),
    content: {
      ...JSON.parse(session.content),
      student_answer: studentAnswer || ""
    },
    history: DEFAULT_HISTORY,
    ui: DEFAULT_UI
  };
}

async function createResponseRow(sessionId, step, promptJson, modelJson) {
  const id = nanoid();
  await run(
    `INSERT INTO responses (id, session_id, step, prompt_json, model_json, student_answer, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)` ,
    [id, sessionId, step, JSON.stringify(promptJson), JSON.stringify(modelJson), null, nowIso()]
  );
  return id;
}

router.post("/start", requireAuth, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const date = todayKey();
  let session = await get("SELECT * FROM sessions WHERE user_id = ? AND date = ?", [user.id, date]);

  if (!session) {
    const sessionId = nanoid();
    await run(
      `INSERT INTO sessions (id, user_id, date, current_step, today_focus, content, core_answer, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
      [sessionId, user.id, date, "warmup", JSON.stringify(DEFAULT_TODAY_FOCUS), JSON.stringify(DEFAULT_CONTENT), null, nowIso()]
    );
    session = await get("SELECT * FROM sessions WHERE id = ?", [sessionId]);
  }

  const currentStep = session.current_step;
  if (currentStep === "done") {
    return res.json({ session_id: session.id, done: true });
  }
  const lastResponse = await get(
    `SELECT * FROM responses WHERE session_id = ? AND step = ? ORDER BY created_at DESC LIMIT 1`,
    [session.id, currentStep]
  );

  if (lastResponse) {
    return res.json({
      session_id: session.id,
      step: currentStep,
      data: JSON.parse(lastResponse.model_json),
      done: currentStep === "feedback"
    });
  }

  const context = buildContext({ mode: currentStep, user, session, studentAnswer: "" });
  const data = await runMode(currentStep, context);
  await createResponseRow(session.id, currentStep, context, data);

  return res.json({ session_id: session.id, step: currentStep, data, done: currentStep === "feedback" });
});

router.post("/next", requireAuth, async (req, res) => {
  const { session_id, step, student_answer } = req.body || {};
  if (!session_id || !step) return res.status(400).json({ error: "missing_fields" });

  const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const session = await get("SELECT * FROM sessions WHERE id = ? AND user_id = ?", [session_id, user.id]);
  if (!session) return res.status(404).json({ error: "session_not_found" });
  if (session.current_step !== step) return res.status(400).json({ error: "step_mismatch" });

  // Update latest response with student answer
  await run(
    `UPDATE responses SET student_answer = ? WHERE id = (
       SELECT id FROM responses WHERE session_id = ? AND step = ? ORDER BY created_at DESC LIMIT 1
     )`,
    [student_answer || "", session.id, step]
  );

  const order = ["warmup", "core_drill", "reinforce", "feedback"];
  const idx = order.indexOf(step);
  if (idx === -1) return res.status(400).json({ error: "invalid_step" });

  if (step === "core_drill") {
    await run("UPDATE sessions SET core_answer = ? WHERE id = ?", [student_answer || "", session.id]);
  }

  if (idx === order.length - 1) {
    await run("UPDATE sessions SET current_step = ? WHERE id = ?", ["done", session.id]);
    return res.json({ session_id: session.id, done: true });
  }

  const nextStep = order[idx + 1];
  let answerForContext = student_answer || "";
  if (nextStep === "feedback") {
    const updatedSession = await get("SELECT * FROM sessions WHERE id = ?", [session.id]);
    answerForContext = updatedSession?.core_answer || "";
  }

  const context = buildContext({ mode: nextStep, user, session, studentAnswer: answerForContext });
  const data = await runMode(nextStep, context);
  await createResponseRow(session.id, nextStep, context, data);
  await run("UPDATE sessions SET current_step = ? WHERE id = ?", [nextStep, session.id]);

  return res.json({ session_id: session.id, step: nextStep, data, done: nextStep === "feedback" });
});

export default router;
