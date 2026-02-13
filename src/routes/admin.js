import express from "express";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { get, all, run } from "../db.js";
import { requireAdmin } from "../middleware/admin.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "change_me";
const ADMIN_KEY = process.env.ADMIN_KEY || "change_me_admin";
const isProd = process.env.ENV === "production";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd
};

router.post("/login", async (req, res) => {
  const { key } = req.body || {};
  if (!key) return res.status(400).json({ error: "missing_key" });
  if (key !== ADMIN_KEY) return res.status(401).json({ error: "invalid_key" });

  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
  res.cookie("admin_token", token, cookieOptions);
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  res.clearCookie("admin_token");
  res.json({ ok: true });
});

router.get("/users", requireAdmin, async (req, res) => {
  const rows = await all(
    `SELECT u.id, u.email, u.name, u.form, u.estimated_band, u.class_name, u.teacher_name, u.created_at,
            COUNT(s.id) as total_sessions,
            SUM(CASE WHEN s.current_step = 'done' THEN 1 ELSE 0 END) as completed_sessions,
            MAX(s.date) as last_active
     FROM users u
     LEFT JOIN sessions s ON s.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  );

  const users = rows.map((r) => {
    const total = Number(r.total_sessions || 0);
    const completed = Number(r.completed_sessions || 0);
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      ...r,
      total_sessions: total,
      completed_sessions: completed,
      completion_rate: rate
    };
  });

  res.json({ users });
});

router.get("/teachers", requireAdmin, async (_req, res) => {
  const teachers = await all(
    `SELECT t.id, t.name, t.email, t.code, t.school_code, t.created_at,
            COUNT(u.id) as student_count,
            SUM(CASE WHEN s.current_step = 'done' THEN 1 ELSE 0 END) as total_completed_sessions,
            MAX(s.date) as last_active
     FROM teachers t
     LEFT JOIN users u ON u.teacher_id = t.id
     LEFT JOIN sessions s ON s.user_id = u.id
     GROUP BY t.id
     ORDER BY t.created_at DESC`
  );

  const totalTeachers = teachers.length;
  const totalAssignedStudents = teachers.reduce((sum, row) => sum + Number(row.student_count || 0), 0);

  res.json({
    summary: {
      total_teachers: totalTeachers,
      total_assigned_students: totalAssignedStudents
    },
    teachers: teachers.map((row) => ({
      ...row,
      student_count: Number(row.student_count || 0),
      total_completed_sessions: Number(row.total_completed_sessions || 0)
    }))
  });
});

router.get("/chat-summary", requireAdmin, async (req, res) => {
  const rows = await all(
    `SELECT u.id, u.name, u.email,
            COUNT(c.id) as chat_count,
            MAX(c.created_at) as last_chat
     FROM users u
     LEFT JOIN chat_messages c ON c.user_id = u.id
     GROUP BY u.id
     ORDER BY chat_count DESC`
  );
  res.json({ items: rows });
});

router.get("/chat-export", requireAdmin, async (req, res) => {
  const rows = await all(
    `SELECT u.email, u.name, c.question, c.answer, c.english_question, c.quick_tip, c.created_at
     FROM chat_messages c
     JOIN users u ON u.id = c.user_id
     ORDER BY c.created_at DESC`
  );

  const header = [
    "email",
    "name",
    "question",
    "answer",
    "english_question",
    "quick_tip",
    "created_at"
  ];
  const escape = (v) => {
    const s = String(v ?? "").replace(/\"/g, '\"\"');
    return `\"${s}\"`;
  };
  const lines = [header.join(",")];
  rows.forEach((r) => {
    lines.push(
      [
        r.email,
        r.name,
        r.question,
        r.answer,
        r.english_question,
        r.quick_tip,
        r.created_at
      ].map(escape).join(",")
    );
  });
  const csv = lines.join("\\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=chat_export.csv");
  res.send(csv);
});

router.post("/delete-user", requireAdmin, async (req, res) => {
  const { email, user_id } = req.body || {};
  if (!email && !user_id) return res.status(400).json({ error: "missing_identifier" });

  const user = user_id
    ? await get("SELECT id FROM users WHERE id = ?", [user_id])
    : await get("SELECT id FROM users WHERE email = ?", [email]);
  if (!user) return res.status(404).json({ error: "not_found" });

  const userId = user.id;
  await run("BEGIN");
  try {
    await run(
      "DELETE FROM responses WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)",
      [userId]
    );
    await run("DELETE FROM sessions WHERE user_id = ?", [userId]);
    await run("DELETE FROM weekly_checkpoints WHERE user_id = ?", [userId]);
    await run("DELETE FROM chat_messages WHERE user_id = ?", [userId]);
    await run("DELETE FROM users WHERE id = ?", [userId]);
    await run("COMMIT");
  } catch (e) {
    await run("ROLLBACK");
    return res.status(500).json({ error: "delete_failed" });
  }

  res.json({ ok: true });
});

router.post("/teacher-reset-code", requireAdmin, async (req, res) => {
  const { teacher_id } = req.body || {};
  if (!teacher_id) return res.status(400).json({ error: "missing_teacher_id" });

  const teacher = await get("SELECT id FROM teachers WHERE id = ?", [teacher_id]);
  if (!teacher) return res.status(404).json({ error: "not_found" });

  const newCode = nanoid(8).toUpperCase();
  await run("UPDATE teachers SET code = ? WHERE id = ?", [newCode, teacher_id]);
  res.json({ ok: true, code: newCode });
});

router.post("/delete-teacher", requireAdmin, async (req, res) => {
  const { teacher_id } = req.body || {};
  if (!teacher_id) return res.status(400).json({ error: "missing_teacher_id" });

  const teacher = await get("SELECT id FROM teachers WHERE id = ?", [teacher_id]);
  if (!teacher) return res.status(404).json({ error: "not_found" });

  await run("BEGIN");
  try {
    await run("UPDATE users SET teacher_id = NULL WHERE teacher_id = ?", [teacher_id]);
    await run("DELETE FROM teachers WHERE id = ?", [teacher_id]);
    await run("COMMIT");
  } catch {
    await run("ROLLBACK");
    return res.status(500).json({ error: "delete_failed" });
  }

  res.json({ ok: true });
});

router.post("/reset-user", requireAdmin, async (req, res) => {
  const { email, user_id } = req.body || {};
  if (!email && !user_id) return res.status(400).json({ error: "missing_identifier" });

  const user = user_id
    ? await get("SELECT id FROM users WHERE id = ?", [user_id])
    : await get("SELECT id FROM users WHERE email = ?", [email]);
  if (!user) return res.status(404).json({ error: "not_found" });

  const userId = user.id;
  await run("BEGIN");
  try {
    await run(
      "DELETE FROM responses WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)",
      [userId]
    );
    await run("DELETE FROM sessions WHERE user_id = ?", [userId]);
    await run("DELETE FROM weekly_checkpoints WHERE user_id = ?", [userId]);
    await run("DELETE FROM chat_messages WHERE user_id = ?", [userId]);
    await run("COMMIT");
  } catch (e) {
    await run("ROLLBACK");
    return res.status(500).json({ error: "reset_failed" });
  }

  res.json({ ok: true });
});

router.post("/school-code", requireAdmin, async (req, res) => {
  const { code, school_name = "" } = req.body || {};
  if (!code) return res.status(400).json({ error: "missing_code" });
  const normalized = String(code).trim().toLowerCase();
  try {
    await run(
      "INSERT INTO school_codes (code, school_name, created_at) VALUES (?, ?, datetime('now'))",
      [normalized, school_name]
    );
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "code_exists" });
  }
});

router.get("/pilot-registrations", requireAdmin, async (_req, res) => {
  const rows = await all(
    `SELECT id, role, full_name, age, school_name, email, phone, address,
            self_intro_text, self_intro_analysis_json, plan_choice, status, created_at
     FROM pilot_registrations
     ORDER BY created_at DESC`
  );

  const items = rows.map((r) => ({
    ...r,
    self_intro_analysis: r.self_intro_analysis_json ? JSON.parse(r.self_intro_analysis_json) : null
  }));

  res.json({ items });
});

router.get("/pilot-export", requireAdmin, async (_req, res) => {
  const rows = await all(
    `SELECT created_at, full_name, role, age, school_name, email, phone, address,
            plan_choice, status, self_intro_text, self_intro_analysis_json
     FROM pilot_registrations
     ORDER BY created_at DESC`
  );

  const header = [
    "submitted_at",
    "name",
    "application_type",
    "age",
    "school_name",
    "email",
    "phone",
    "address",
    "plan_choice",
    "status",
    "self_intro_text",
    "ai_overall_comment",
    "ai_strengths",
    "ai_improvements",
    "ai_grammar_vocab",
    "ai_problem_sentences",
    "ai_rewritten_sentences"
  ];

  const escape = (v) => {
    const s = String(v ?? "").replace(/\"/g, '\"\"');
    return `\"${s}\"`;
  };

  const lines = [header.join(",")];
  rows.forEach((r) => {
    let analysis = null;
    try {
      analysis = r.self_intro_analysis_json ? JSON.parse(r.self_intro_analysis_json) : null;
    } catch {
      analysis = null;
    }

    const strengths = Array.isArray(analysis?.strengths) ? analysis.strengths.join(" | ") : "";
    const improvements = Array.isArray(analysis?.improvements) ? analysis.improvements.join(" | ") : "";
    const grammarVocab = Array.isArray(analysis?.grammar_vocab_notes) ? analysis.grammar_vocab_notes.join(" | ") : "";
    const problemSentences = Array.isArray(analysis?.problem_sentences)
      ? analysis.problem_sentences.map((x) => `${x.original || ""} => ${x.fixed || ""}`).join(" || ")
      : "";
    const rewritten = Array.isArray(analysis?.rewritten_sentences) ? analysis.rewritten_sentences.join(" | ") : "";

    lines.push(
      [
        r.created_at,
        r.full_name,
        r.role,
        r.age,
        r.school_name,
        r.email,
        r.phone,
        r.address,
        r.plan_choice,
        r.status,
        r.self_intro_text,
        analysis?.overall_comment || "",
        strengths,
        improvements,
        grammarVocab,
        problemSentences,
        rewritten
      ].map(escape).join(",")
    );
  });

  const csv = lines.join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=pilot_registrations_export.csv");
  res.send(csv);
});

router.get("/register-examples", requireAdmin, async (_req, res) => {
  const rows = await all(
    `SELECT id, sort_order, before_text, after_text
     FROM register_examples
     ORDER BY sort_order ASC, id ASC`
  );
  res.json({ items: rows });
});

router.post("/register-examples", requireAdmin, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "missing_items" });

  const normalized = items.map((item, idx) => ({
    sort_order: idx + 1,
    before_text: String(item.before_text || "").trim(),
    after_text: String(item.after_text || "").trim()
  }));

  if (normalized.some((item) => !item.before_text || !item.after_text)) {
    return res.status(400).json({ error: "missing_fields" });
  }

  await run("BEGIN");
  try {
    await run("DELETE FROM register_examples");
    for (const item of normalized) {
      await run(
        `INSERT INTO register_examples (sort_order, before_text, after_text, updated_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [item.sort_order, item.before_text, item.after_text]
      );
    }
    await run("COMMIT");
  } catch {
    await run("ROLLBACK");
    return res.status(500).json({ error: "save_failed" });
  }

  res.json({ ok: true });
});

router.post("/pilot-approve", requireAdmin, async (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "missing_id" });

  const target = await get("SELECT id, status FROM pilot_registrations WHERE id = ?", [id]);
  if (!target) return res.status(404).json({ error: "not_found" });
  if (target.status === "APPROVED") return res.json({ ok: true });

  const row = await get(
    "SELECT COUNT(*) AS approved FROM pilot_registrations WHERE status = 'APPROVED'"
  );
  const approved = Number(row?.approved || 0);
  if (approved >= 100) return res.status(400).json({ error: "seats_full" });

  await run("UPDATE pilot_registrations SET status = 'APPROVED' WHERE id = ?", [id]);
  res.json({ ok: true });
});

export default router;
