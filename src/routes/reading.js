import express from "express";
import { nanoid } from "nanoid";
import { requireAuth } from "../middleware/auth.js";
import { get, run } from "../db.js";
import { nowIso, todayKey } from "../utils.js";

const router = express.Router();

const READING_SET = {
  title: "Reading Decoder",
  passage:
    "Many schools now run reading clubs after class. Students meet once a week to read short articles and discuss ideas together. Teachers noticed that students who join regularly become more confident during exams. They also answer comprehension questions faster because they can identify key points quickly. Some students first joined only to improve grades, but later they found reading enjoyable and useful in daily life.",
  questions: [
    {
      id: "rq1",
      prompt: "What is the main idea of the passage?",
      options: [
        "Reading clubs help students improve confidence and comprehension skills.",
        "Only top students should join reading clubs.",
        "Reading clubs are mostly for sports activities.",
        "Teachers should cancel reading clubs after exams."
      ],
      answer_key: "Reading clubs help students improve confidence and comprehension skills.",
      explanation: "The passage focuses on how regular reading club practice improves exam performance and confidence."
    },
    {
      id: "rq2",
      prompt: "Why do students answer comprehension questions faster?",
      options: [
        "They memorize every article.",
        "They can identify key points quickly.",
        "They skip long passages.",
        "They get extra exam time."
      ],
      answer_key: "They can identify key points quickly.",
      explanation: "The passage directly states this as the reason for faster answers."
    },
    {
      id: "rq3",
      prompt: "Which statement is TRUE based on the passage?",
      options: [
        "Students disliked reading clubs after joining.",
        "Reading clubs happen every day.",
        "Some students joined for grades but later enjoyed reading.",
        "Reading clubs only help with writing, not reading."
      ],
      answer_key: "Some students joined for grades but later enjoyed reading.",
      explanation: "The last sentence confirms students first joined for grades and later enjoyed reading."
    }
  ]
};

function buildInitialInfo() {
  return {
    mode: "question_active",
    current_index: 0,
    total_questions: READING_SET.questions.length,
    stars: 0,
    answered: {}
  };
}

function buildQuestionPayload(info) {
  const q = READING_SET.questions[Number(info.current_index || 0)];
  return {
    state: "question_active",
    title: READING_SET.title,
    passage: READING_SET.passage,
    question_index: Number(info.current_index || 0) + 1,
    total_questions: info.total_questions,
    question: {
      id: q.id,
      prompt: q.prompt,
      options: q.options
    },
    stars: Number(info.stars || 0)
  };
}

async function upsertResponse(sessionId, step, promptJson, modelJson, studentAnswer = null) {
  await run(
    `INSERT INTO reading_responses (id, session_id, step, prompt_json, model_json, student_answer, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nanoid(), sessionId, step, JSON.stringify(promptJson), JSON.stringify(modelJson), studentAnswer, nowIso()]
  );
}

router.post("/start", requireAuth, async (req, res) => {
  const user = await get("SELECT id FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const date = todayKey();
  let session = await get("SELECT * FROM reading_sessions WHERE user_id = ? AND date = ?", [user.id, date]);

  if (!session) {
    const info = buildInitialInfo();
    const id = nanoid();
    await run(
      `INSERT INTO reading_sessions (id, user_id, date, current_step, reading_info, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, user.id, date, "question_active", JSON.stringify(info), nowIso()]
    );
    session = await get("SELECT * FROM reading_sessions WHERE id = ?", [id]);
  }

  let info = {};
  try {
    info = JSON.parse(session.reading_info || "{}");
  } catch {
    info = buildInitialInfo();
  }

  if (session.current_step === "done") {
    return res.json({
      session_id: session.id,
      done: true,
      summary: {
        accuracy_percent: 100,
        stars: Number(info.stars || 0),
        message: "Today’s reading drill completed."
      }
    });
  }

  const payload = buildQuestionPayload(info);
  await upsertResponse(session.id, "question_active", { state: "question_active" }, payload);
  return res.json({ session_id: session.id, done: false, ...payload });
});

router.post("/next", requireAuth, async (req, res) => {
  const { session_id, action, selected_option } = req.body || {};
  if (!session_id || !action) return res.status(400).json({ error: "missing_fields" });

  const session = await get("SELECT * FROM reading_sessions WHERE id = ? AND user_id = ?", [session_id, req.user.id]);
  if (!session) return res.status(404).json({ error: "session_not_found" });
  if (session.current_step === "done") return res.status(400).json({ error: "session_finished" });

  const info = JSON.parse(session.reading_info || "{}");
  const q = READING_SET.questions[Number(info.current_index || 0)];
  if (!q) return res.status(400).json({ error: "invalid_question_state" });

  if (action === "answer") {
    if (!selected_option) return res.status(400).json({ error: "missing_option" });
    const isCorrect = String(selected_option).trim() === q.answer_key;
    info.answered[q.id] = {
      selected_option,
      correct: isCorrect
    };
    if (isCorrect) info.stars = Number(info.stars || 0) + 1;

    await run(
      "UPDATE reading_sessions SET reading_info = ? WHERE id = ?",
      [JSON.stringify(info), session.id]
    );
    const payload = {
      state: "feedback_shown",
      question_index: Number(info.current_index || 0) + 1,
      total_questions: info.total_questions,
      feedback: {
        correct: isCorrect,
        reason: q.explanation,
        correct_answer: q.answer_key
      },
      continue_available: true,
      stars: Number(info.stars || 0)
    };
    await upsertResponse(session.id, "feedback_shown", { action, selected_option }, payload, selected_option);
    return res.json({ session_id: session.id, done: false, ...payload });
  }

  if (action === "next_question") {
    info.current_index = Number(info.current_index || 0) + 1;
    if (info.current_index >= info.total_questions) {
      const answered = Object.values(info.answered || {});
      const correctCount = answered.filter((x) => x.correct).length;
      const attempted = answered.length;
      const accuracy = attempted ? Math.round((correctCount / attempted) * 100) : 0;
      await run(
        "UPDATE reading_sessions SET current_step = ?, reading_info = ? WHERE id = ?",
        ["done", JSON.stringify(info), session.id]
      );
      return res.json({
        session_id: session.id,
        done: true,
        state: "finished",
        summary: {
          accuracy_percent: accuracy,
          stars: Number(info.stars || 0),
          message: "Great work. You finished today’s Reading Decoder set."
        }
      });
    }

    await run(
      "UPDATE reading_sessions SET current_step = ?, reading_info = ? WHERE id = ?",
      ["question_active", JSON.stringify(info), session.id]
    );
    const payload = buildQuestionPayload(info);
    await upsertResponse(session.id, "question_active", { action }, payload);
    return res.json({ session_id: session.id, done: false, ...payload });
  }

  return res.status(400).json({ error: "invalid_action" });
});

export default router;
