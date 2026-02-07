import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { get, run } from "../db.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.user.id]);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    form: user.form,
    estimated_band: user.estimated_band,
    class_name: user.class_name || "",
    teacher_name: user.teacher_name || "",
    weaknesses: JSON.parse(user.weaknesses || "[]"),
    strengths: JSON.parse(user.strengths || "[]")
  });
});

router.get("/dashboard", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const sessions = await get(
    `SELECT COUNT(DISTINCT date) as day_count FROM sessions WHERE user_id = ?`,
    [userId]
  );
  const completed = await get(
    `SELECT COUNT(DISTINCT date) as completed_count FROM sessions WHERE user_id = ? AND current_step = 'done'`,
    [userId]
  );
  const today = new Date().toISOString().slice(0, 10);
  const todayRow = await get(
    `SELECT current_step FROM sessions WHERE user_id = ? AND date = ?`,
    [userId, today]
  );

  const completedDays = Number(sessions?.day_count || 0);
  const completedSessions = Number(completed?.completed_count || 0);
  const todayStarted = Boolean(todayRow);
  const dayIndex = todayStarted ? completedDays : Math.min(completedDays + 1, 14);

  res.json({
    day_index: dayIndex,
    total_days: 14,
    focus: "Writing Focus",
    today_started: todayStarted,
    today_done: todayRow?.current_step === "done",
    completed_days: completedSessions,
    completion_rate: Math.round((completedSessions / 14) * 100),
    total_stars: completedSessions
  });
});

router.post("/profile", requireAuth, async (req, res) => {
  const { name, class_name, teacher_name, form, estimated_band } = req.body || {};

  const updates = [];
  const params = [];

  if (typeof name === "string" && name.trim()) {
    updates.push("name = ?");
    params.push(name.trim());
  }
  if (typeof class_name === "string") {
    updates.push("class_name = ?");
    params.push(class_name.trim());
  }
  if (typeof teacher_name === "string") {
    updates.push("teacher_name = ?");
    params.push(teacher_name.trim());
  }
  if (typeof form === "number") {
    updates.push("form = ?");
    params.push(form);
  }
  if (typeof estimated_band === "number") {
    updates.push("estimated_band = ?");
    params.push(estimated_band);
  }

  if (updates.length === 0) return res.status(400).json({ error: "no_updates" });

  params.push(req.user.id);
  await run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

  res.json({ ok: true });
});

export default router;
