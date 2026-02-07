import express from "express";
import jwt from "jsonwebtoken";
import { get, all } from "../db.js";
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

export default router;
