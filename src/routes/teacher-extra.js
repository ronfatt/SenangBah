import express from "express";
import { get, run, all } from "../db.js";
import { requireTeacher } from "../middleware/teacher.js";

const router = express.Router();

router.post("/reset-student", requireTeacher, async (req, res) => {
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: "missing_user_id" });

  const student = await get(
    "SELECT id, teacher_id FROM users WHERE id = ?",
    [user_id]
  );
  if (!student || student.teacher_id !== req.teacher.id) {
    return res.status(403).json({ error: "forbidden" });
  }

  await run("BEGIN");
  try {
    await run(
      "DELETE FROM responses WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ?)",
      [user_id]
    );
    await run("DELETE FROM sessions WHERE user_id = ?", [user_id]);
    await run("DELETE FROM weekly_checkpoints WHERE user_id = ?", [user_id]);
    await run("DELETE FROM chat_messages WHERE user_id = ?", [user_id]);
    await run("DELETE FROM vocab_sessions WHERE user_id = ?", [user_id]);
    await run("DELETE FROM vocab_responses WHERE session_id NOT IN (SELECT id FROM vocab_sessions)");
    await run("DELETE FROM essay_uploads WHERE user_id = ?", [user_id]);
    await run("COMMIT");
  } catch {
    await run("ROLLBACK");
    return res.status(500).json({ error: "reset_failed" });
  }

  res.json({ ok: true });
});

router.get("/essay-uploads", requireTeacher, async (req, res) => {
  const rows = await all(
    `SELECT e.id, e.file_path, e.original_name, e.extracted_text, e.analysis_json, e.created_at,
            u.name as student_name, u.email as student_email
     FROM essay_uploads e
     JOIN users u ON u.id = e.user_id
     WHERE u.teacher_id = ?
     ORDER BY e.created_at DESC`,
    [req.teacher.id]
  );

  const items = rows.map((r) => ({
    id: r.id,
    file_path: r.file_path,
    original_name: r.original_name,
    extracted_text: r.extracted_text,
    analysis: JSON.parse(r.analysis_json || "{}"),
    created_at: r.created_at,
    student_name: r.student_name,
    student_email: r.student_email
  }));

  res.json({ items });
});

router.post("/teacher-name", async (req, res) => {
  const { teacher_code } = req.body || {};
  if (!teacher_code) return res.status(400).json({ error: "missing_teacher_code" });
  const normalized = String(teacher_code).trim().toUpperCase();
  const teacher = await get("SELECT name FROM teachers WHERE code = ?", [normalized]);
  if (!teacher) return res.status(404).json({ error: "not_found" });
  res.json({ name: teacher.name });
});

export default router;
