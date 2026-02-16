import express from "express";
import { nanoid } from "nanoid";
import { requireAuth } from "../middleware/auth.js";
import { get, run } from "../db.js";
import { nowIso, todayKey } from "../utils.js";

const router = express.Router();

const CLOZE_SETS = [
  {
    passage_id: "rc_set_01",
    title: "Paper 1 Use of English – Rational Cloze",
    passage_template:
      "Many teenagers now use study planners to manage their time. A planner is [BLANK_1] than a simple to-do list because it helps students see priorities. If they [BLANK_2] their work early, they can avoid last-minute stress. In addition, students should focus [BLANK_3] one task at a time. This method is [BLANK_4] effective than multitasking. Teachers often remind students [BLANK_5] revision must be consistent. With good planning, exam preparation becomes [BLANK_6] and more controlled.",
    questions: [
      {
        id: "q1",
        blank_index: 1,
        sentence_with_blank:
          "A planner is [____] than a simple to-do list because it helps students see priorities.",
        options: ["more useful", "most useful", "usefuler", "useful"],
        correct_option: "more useful",
        focus_rule_tag: "Comparative",
        difficulty_band: "Band 4-5",
        min_fix_constraint: "change_1_word",
        explanation_short: "Use comparative form before 'than'.",
        example_sentence: "This method is more practical than the old one.",
        hint: "Use 'more + adjective' for longer adjectives.",
        tip: "Comparative needs 'than'."
      },
      {
        id: "q2",
        blank_index: 2,
        sentence_with_blank:
          "If they [____] their work early, they can avoid last-minute stress.",
        options: ["plan", "plans", "planned", "planning"],
        correct_option: "plan",
        focus_rule_tag: "Subject-Verb Agreement",
        difficulty_band: "Band 4",
        min_fix_constraint: "change_1_word",
        explanation_short: "Plural subject 'they' uses base verb.",
        example_sentence: "They finish their homework before dinner.",
        hint: "Check the subject before choosing the verb form.",
        tip: "Plural subject = base verb."
      },
      {
        id: "q3",
        blank_index: 3,
        sentence_with_blank:
          "In addition, students should focus [____] one task at a time.",
        options: ["in", "on", "at", "to"],
        correct_option: "on",
        focus_rule_tag: "Preposition",
        difficulty_band: "Band 4",
        min_fix_constraint: "change_1_word",
        explanation_short: "The collocation is 'focus on'.",
        example_sentence: "Please focus on the main question.",
        hint: "Think of the fixed phrase after 'focus'.",
        tip: "Learn common verb-preposition pairs."
      },
      {
        id: "q4",
        blank_index: 4,
        sentence_with_blank:
          "This method is [____] effective than multitasking.",
        options: ["most", "much", "more", "many"],
        correct_option: "more",
        focus_rule_tag: "Comparative",
        difficulty_band: "Band 5",
        min_fix_constraint: "change_1_word",
        explanation_short: "Comparative with adjective 'effective' is 'more effective'.",
        example_sentence: "Reading daily is more effective than last-minute study.",
        hint: "Comparative marker appears before adjective + than.",
        tip: "Long adjective usually uses 'more'."
      },
      {
        id: "q5",
        blank_index: 5,
        sentence_with_blank:
          "Teachers often remind students [____] revision must be consistent.",
        options: ["that", "which", "where", "who"],
        correct_option: "that",
        focus_rule_tag: "Clause Linker",
        difficulty_band: "Band 5",
        min_fix_constraint: "max_2_words",
        explanation_short: "'Remind + object + that-clause' is the correct structure.",
        example_sentence: "The coach reminded us that practice matters.",
        hint: "Choose the conjunction that introduces a statement.",
        tip: "Use 'that' to introduce content clauses."
      },
      {
        id: "q6",
        blank_index: 6,
        sentence_with_blank:
          "With good planning, exam preparation becomes [____] and more controlled.",
        options: ["easy", "easier", "easiest", "more easy"],
        correct_option: "easier",
        focus_rule_tag: "Comparative",
        difficulty_band: "Band 4-5",
        min_fix_constraint: "change_1_word",
        explanation_short: "Use comparative adjective to match 'more controlled'.",
        example_sentence: "Practice makes writing easier over time.",
        hint: "Short adjective usually takes -er.",
        tip: "Short adjective often uses -er form."
      }
    ]
  }
];

const STEP_ORDER = ["started", "question_active", "answered", "feedback_shown", "next_question", "finished"];

function chooseSetByDate() {
  const date = new Date();
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const day = Math.floor(diff / 86400000);
  return CLOZE_SETS[day % CLOZE_SETS.length];
}

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTokens(value = "") {
  return normalizeText(value).split(" ").filter(Boolean);
}

function diffTokens(actual, expected) {
  const a = splitTokens(actual);
  const e = splitTokens(expected);
  const max = Math.max(a.length, e.length);
  const wrong = [];
  for (let i = 0; i < max; i += 1) {
    if ((a[i] || "") !== (e[i] || "")) {
      wrong.push({ index: i, actual: a[i] || "", expected: e[i] || "" });
    }
  }
  return wrong;
}

function topMissedTags(missed = {}) {
  return Object.entries(missed)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([tag]) => tag);
}

function buildSuggestedDrill(tags = []) {
  if (!tags.length) return "Repeat one Rational Cloze set focusing on grammar precision.";
  if (tags[0] === "Comparative") return "Do a comparative form mini-drill with 10 'than' sentences.";
  if (tags[0] === "Preposition") return "Do a verb-preposition collocation drill for 8 common pairs.";
  return `Run one mini drill focused on ${tags[0]} with 6 targeted blanks.`;
}

function buildInitialSessionInfo(set) {
  return {
    mode: STEP_ORDER[0],
    state: "started",
    passage_id: set.passage_id,
    title: set.title,
    passage_template: set.passage_template,
    total_questions: set.questions.length,
    questions: set.questions,
    current_index: 0,
    stars: 0,
    attempted: 0,
    correct: 0,
    hint_used_count: 0,
    missed_rule_tags: {},
    answered: {}
  };
}

function buildPassageForQuestion(sessionInfo, q) {
  return sessionInfo.passage_template.replace(/\[BLANK_(\d+)\]/g, (full, raw) => {
    const idx = Number(raw);
    const key = `q_${idx}`;
    const answered = sessionInfo.answered?.[key]?.selected_option;
    if (idx === q.blank_index) return "[____]";
    return answered || "_____";
  });
}

function buildQuestionPayload(sessionInfo) {
  const idx = Number(sessionInfo.current_index || 0);
  const q = sessionInfo.questions[idx];
  const passage = buildPassageForQuestion(sessionInfo, q);
  const selected = sessionInfo.answered?.[`q_${q.blank_index}`]?.selected_option || "";

  return {
    state: "question_active",
    question: {
      id: q.id,
      passage_id: sessionInfo.passage_id,
      blank_index: q.blank_index,
      sentence_with_blank: q.sentence_with_blank,
      options: q.options,
      correct_option: q.correct_option,
      focus_rule_tag: q.focus_rule_tag,
      difficulty_band: q.difficulty_band,
      min_fix_constraint: q.min_fix_constraint,
      explanation_short: q.explanation_short,
      example_sentence: q.example_sentence
    },
    question_index: idx + 1,
    total_questions: sessionInfo.total_questions,
    instruction_primary: `Blank #${q.blank_index} — Focus: ${q.focus_rule_tag} (${q.min_fix_constraint === "change_1_word" ? "Change 1 word only" : "Max 2 words"})`,
    instruction_secondary: "Rewrite the full sentence (use your chosen word).",
    instruction_tip: `Tip: ${q.hint}`,
    focus_rule_tag: q.focus_rule_tag,
    passage_text: passage,
    selected_option: selected,
    stars: sessionInfo.stars
  };
}

function evaluateOption(question, selectedOption, hintUsed) {
  const isCorrect = normalizeText(selectedOption) === normalizeText(question.correct_option);
  const hintPenalty = hintUsed ? 1 : 0;
  const starDelta = (isCorrect ? 1 : 0) - hintPenalty;
  return {
    isCorrect,
    hintPenalty,
    starDelta,
    feedback: {
      correctness: isCorrect ? "correct" : "incorrect",
      focus_rule_tag: question.focus_rule_tag,
      reason: isCorrect ? question.explanation_short : `Focus on ${question.focus_rule_tag}. Choose the option that fits grammar and meaning.`,
      example_sentence: question.example_sentence,
      micro_tip: question.tip,
      hint_used: hintUsed
    }
  };
}

function evaluateRewrite(question, selectedOption, rewriteText) {
  const expectedSentence = question.sentence_with_blank.replace("[____]", question.correct_option);
  const rewrite = String(rewriteText || "").trim();
  const wrongTokens = diffTokens(rewrite, expectedSentence);
  const containsCorrectWord = normalizeText(rewrite).includes(normalizeText(question.correct_option));
  const allowed = question.min_fix_constraint === "change_1_word" ? 1 : 2;
  const rewriteCorrect = containsCorrectWord && wrongTokens.length <= allowed;
  const firstWrong = wrongTokens[0];

  return {
    rewrite_correct: rewriteCorrect,
    wrong_tokens: wrongTokens.slice(0, 3),
    what_to_fix: rewriteCorrect
      ? "Good fix. Keep the grammar pattern exactly."
      : `Fix the word near "${firstWrong?.actual || selectedOption || "your edit"}".`,
    why: rewriteCorrect
      ? `Your sentence matches the ${question.focus_rule_tag} rule.`
      : `This rule requires ${question.correct_option} in this sentence.`,
    correct_answer: expectedSentence
  };
}

async function upsertResponse(sessionId, step, promptJson, modelJson, studentAnswer = null) {
  const id = nanoid();
  await run(
    `INSERT INTO grammar_responses (id, session_id, step, prompt_json, model_json, student_answer, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, sessionId, step, JSON.stringify(promptJson), JSON.stringify(modelJson), studentAnswer, nowIso()]
  );
}

async function saveSessionInfo(sessionId, currentStep, info) {
  await run(
    "UPDATE grammar_sessions SET current_step = ?, grammar_info = ? WHERE id = ?",
    [currentStep, JSON.stringify(info), sessionId]
  );
}

router.post("/start", requireAuth, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const date = todayKey();
  let session = await get("SELECT * FROM grammar_sessions WHERE user_id = ? AND date = ?", [user.id, date]);

  if (!session) {
    const set = chooseSetByDate();
    const info = buildInitialSessionInfo(set);
    const id = nanoid();
    await run(
      `INSERT INTO grammar_sessions (id, user_id, date, current_step, grammar_info, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, user.id, date, "question_active", JSON.stringify(info), nowIso()]
    );
    session = await get("SELECT * FROM grammar_sessions WHERE id = ?", [id]);
  }

  let info = {};
  try {
    info = JSON.parse(session.grammar_info || "{}");
  } catch {
    info = {};
  }

  const looksLikeLegacySession =
    !Array.isArray(info.questions) ||
    !info.questions.length ||
    typeof info.current_index !== "number" ||
    typeof info.total_questions !== "number" ||
    !info.passage_template ||
    !["question_active", "feedback_shown", "next_question", "done"].includes(session.current_step);

  if (looksLikeLegacySession) {
    const set = chooseSetByDate();
    info = buildInitialSessionInfo(set);
    await run(
      "UPDATE grammar_sessions SET current_step = ?, grammar_info = ? WHERE id = ?",
      ["question_active", JSON.stringify(info), session.id]
    );
    session.current_step = "question_active";
  }

  if (session.current_step === "done") {
    const attempted = Number(info.attempted || 0);
    const correct = Number(info.correct || 0);
    const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
    const topTags = topMissedTags(info.missed_rule_tags || {});
    return res.json({
      session_id: session.id,
      state: "finished",
      done: true,
      summary: {
        accuracy_percent: accuracy,
        top_missed_focus_rule_tags: topTags,
        suggested_next_drill: buildSuggestedDrill(topTags),
        stars: info.stars || 0
      }
    });
  }

  const payload = buildQuestionPayload(info);
  await upsertResponse(session.id, "question_active", { state: "question_active" }, payload);
  await saveSessionInfo(session.id, "question_active", { ...info, state: "question_active", mode: "question_active" });

  return res.json({
    session_id: session.id,
    done: false,
    ...payload
  });
});

router.post("/next", requireAuth, async (req, res) => {
  const { session_id, action, selected_option, rewrite_text, hint_used } = req.body || {};
  if (!session_id || !action) return res.status(400).json({ error: "missing_fields" });

  const session = await get("SELECT * FROM grammar_sessions WHERE id = ? AND user_id = ?", [session_id, req.user.id]);
  if (!session) return res.status(404).json({ error: "session_not_found" });
  if (session.current_step === "done") return res.status(400).json({ error: "session_finished" });

  const info = JSON.parse(session.grammar_info || "{}");
  const q = info.questions?.[info.current_index || 0];
  if (!q) return res.status(400).json({ error: "invalid_question_state" });
  const answerKey = `q_${q.blank_index}`;
  info.answered = info.answered || {};

  if (action === "answer_option") {
    if (!selected_option) return res.status(400).json({ error: "missing_option" });
    const previous = info.answered?.[answerKey];
    if (previous?.option_checked) {
      return res.json({
        session_id: session.id,
        done: false,
        state: "feedback_shown",
        question_index: Number(info.current_index || 0) + 1,
        total_questions: info.total_questions,
        focus_rule_tag: q.focus_rule_tag,
        option_feedback: previous.option_feedback,
        rewrite_target: q.sentence_with_blank,
        min_fix_constraint: q.min_fix_constraint,
        can_rewrite: true
      });
    }
    const hintUsed = Boolean(hint_used);
    const checked = evaluateOption(q, selected_option, hintUsed);

    info.answered[answerKey] = {
      ...(info.answered[answerKey] || {}),
      selected_option,
      option_correct: checked.isCorrect,
      hint_used: hintUsed,
      option_checked: true,
      option_feedback: checked.feedback
    };
    if (hintUsed) info.hint_used_count = Number(info.hint_used_count || 0) + 1;
    info.stars = Math.max(0, Number(info.stars || 0) + checked.starDelta);
    info.state = "feedback_shown";
    info.mode = "feedback_shown";

    const payload = {
      state: "feedback_shown",
      question_index: Number(info.current_index || 0) + 1,
      total_questions: info.total_questions,
      focus_rule_tag: q.focus_rule_tag,
      option_feedback: checked.feedback,
      rewrite_target: q.sentence_with_blank,
      min_fix_constraint: q.min_fix_constraint,
      can_rewrite: true
    };

    await upsertResponse(session.id, "answered", { action, selected_option, hint_used: hintUsed }, payload, selected_option);
    await saveSessionInfo(session.id, "feedback_shown", info);
    return res.json({ session_id: session.id, done: false, ...payload });
  }

  if (action === "submit_rewrite") {
    const selected = info.answered?.[answerKey]?.selected_option || "";
    if (!selected) return res.status(400).json({ error: "answer_option_first" });
    if (!String(rewrite_text || "").trim()) return res.status(400).json({ error: "missing_rewrite" });

    const rewriteResult = evaluateRewrite(q, selected, rewrite_text);
    const wasOptionCorrect = Boolean(info.answered?.[answerKey]?.option_correct);
    const finalCorrect = wasOptionCorrect && rewriteResult.rewrite_correct;
    info.answered[answerKey] = {
      ...(info.answered[answerKey] || {}),
      rewrite_text: String(rewrite_text || ""),
      rewrite_correct: rewriteResult.rewrite_correct,
      final_correct: finalCorrect
    };
    info.attempted = Number(info.attempted || 0) + 1;
    if (finalCorrect) info.correct = Number(info.correct || 0) + 1;
    if (!finalCorrect) {
      info.missed_rule_tags = info.missed_rule_tags || {};
      info.missed_rule_tags[q.focus_rule_tag] = Number(info.missed_rule_tags[q.focus_rule_tag] || 0) + 1;
    }
    info.state = "feedback_shown";
    info.mode = "feedback_shown";

    const payload = {
      state: "feedback_shown",
      question_index: Number(info.current_index || 0) + 1,
      total_questions: info.total_questions,
      focus_rule_tag: q.focus_rule_tag,
      rewrite_feedback: rewriteResult,
      continue_available: true
    };

    await upsertResponse(session.id, "feedback_shown", { action, rewrite_text }, payload, rewrite_text);
    await saveSessionInfo(session.id, "feedback_shown", info);
    return res.json({ session_id: session.id, done: false, ...payload });
  }

  if (action === "next_question") {
    info.current_index = Number(info.current_index || 0) + 1;
    if (info.current_index >= info.total_questions) {
      info.state = "finished";
      info.mode = "finished";
      const attempted = Number(info.attempted || 0);
      const correct = Number(info.correct || 0);
      const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
      const topTags = topMissedTags(info.missed_rule_tags || {});
      await saveSessionInfo(session.id, "done", info);
      return res.json({
        session_id: session.id,
        done: true,
        state: "finished",
        summary: {
          accuracy_percent: accuracy,
          top_missed_focus_rule_tags: topTags,
          suggested_next_drill: buildSuggestedDrill(topTags),
          stars: info.stars || 0
        }
      });
    }

    info.state = "next_question";
    info.mode = "next_question";
    await saveSessionInfo(session.id, "next_question", info);

    const payload = buildQuestionPayload(info);
    info.state = "question_active";
    info.mode = "question_active";
    await saveSessionInfo(session.id, "question_active", info);
    await upsertResponse(session.id, "next_question", { action }, payload);
    return res.json({ session_id: session.id, done: false, ...payload });
  }

  return res.status(400).json({ error: "invalid_action" });
});

export default router;
