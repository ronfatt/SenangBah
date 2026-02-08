import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { run, get, all } from "../db.js";
import { nowIso } from "../utils.js";
import { requireTeacher } from "../middleware/teacher.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "change_me";
const isProd = process.env.ENV === "production";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd
};

function signTeacherToken(teacher) {
  return jwt.sign({ id: teacher.id, email: teacher.email, name: teacher.name, role: "teacher" }, JWT_SECRET, {
    expiresIn: "7d"
  });
}

router.post("/register", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: "missing_fields" });

  const existing = await get("SELECT id FROM teachers WHERE email = ?", [email]);
  if (existing) return res.status(409).json({ error: "email_taken" });

  const hash = await bcrypt.hash(password, 10);
  const id = nanoid();
  const code = nanoid(8).toUpperCase();

  await run(
    `INSERT INTO teachers (id, email, password_hash, name, code, created_at)
     VALUES (?, ?, ?, ?, ?, ?)` ,
    [id, email, hash, name, code, nowIso()]
  );

  const token = signTeacherToken({ id, email, name });
  res.cookie("teacher_token", token, cookieOptions);
  res.json({ ok: true, code });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "missing_fields" });

  const teacher = await get("SELECT * FROM teachers WHERE email = ?", [email]);
  if (!teacher) return res.status(401).json({ error: "invalid_credentials" });

  const ok = await bcrypt.compare(password, teacher.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = signTeacherToken(teacher);
  res.cookie("teacher_token", token, cookieOptions);
  res.json({ ok: true, code: teacher.code });
});

router.post("/logout", (req, res) => {
  res.clearCookie("teacher_token");
  res.json({ ok: true });
});

router.get("/me", requireTeacher, async (req, res) => {
  const teacher = await get("SELECT id, email, name, code FROM teachers WHERE id = ?", [req.teacher.id]);
  if (!teacher) return res.status(401).json({ error: "unauthorized" });
  res.json(teacher);
});

router.get("/students", requireTeacher, async (req, res) => {
  const rows = await all(
    `SELECT u.id, u.name, u.email, u.class_name, u.teacher_name, u.form, u.estimated_band,
            COUNT(s.id) as total_sessions,
            SUM(CASE WHEN s.current_step = 'done' THEN 1 ELSE 0 END) as completed_sessions,
            MAX(s.date) as last_active
     FROM users u
     LEFT JOIN sessions s ON s.user_id = u.id
     WHERE u.teacher_id = ?
     GROUP BY u.id
     ORDER BY u.created_at DESC`,
    [req.teacher.id]
  );

  const students = rows.map((r) => {
    const total = Number(r.total_sessions || 0);
    const completed = Number(r.completed_sessions || 0);
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { ...r, total_sessions: total, completed_sessions: completed, completion_rate: rate };
  });

  res.json({ students });
});

export default router;
