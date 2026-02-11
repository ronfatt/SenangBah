import express from "express";
import jwt from "jsonwebtoken";
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

export default router;
