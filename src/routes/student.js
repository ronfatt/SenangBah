import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { all, get, run } from "../db.js";
import { ensureUserReferralCode } from "../referral.js";

const router = express.Router();
const ACCESS_DAYS_TOTAL = 30;

function getAccessStatus(createdAtValue) {
  const createdAt = createdAtValue ? new Date(createdAtValue) : null;
  const elapsedDays = createdAt && !Number.isNaN(createdAt.getTime())
    ? Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86400000))
    : 0;
  return {
    access_days_total: ACCESS_DAYS_TOTAL,
    access_days_left: Math.max(0, ACCESS_DAYS_TOTAL - elapsedDays),
    access_label: "30-Day Full Access"
  };
}

router.get("/me", requireAuth, async (req, res) => {
  const user = await get(
    `SELECT u.*, sc.school_name
     FROM users u
     LEFT JOIN teachers t ON t.id = u.teacher_id
     LEFT JOIN school_codes sc ON sc.code = t.school_code
     WHERE u.id = ?`,
    [req.user.id]
  );
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const referralCode = await ensureUserReferralCode(user.id, user.name);
  const accessStatus = getAccessStatus(user.created_at);

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    form: user.form,
    estimated_band: user.estimated_band,
    class_name: user.class_name || "",
    teacher_name: user.teacher_name || "",
    school_name: user.school_name || "",
    referral_code: referralCode,
    referred_by_code: user.referred_by_code || "",
    bonus_stars: Number(user.bonus_stars || 0),
    access_days_total: accessStatus.access_days_total,
    access_days_left: accessStatus.access_days_left,
    access_label: accessStatus.access_label,
    weaknesses: JSON.parse(user.weaknesses || "[]"),
    strengths: JSON.parse(user.strengths || "[]")
  });
});

router.get("/dashboard", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const user = await get(
    `SELECT u.estimated_band, u.bonus_stars, u.name, u.referred_by_code, u.created_at, sc.school_name
     FROM users u
     LEFT JOIN teachers t ON t.id = u.teacher_id
     LEFT JOIN school_codes sc ON sc.code = t.school_code
     WHERE u.id = ?`,
    [userId]
  );
  const referralCode = await ensureUserReferralCode(userId, user?.name || "");
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

  const vocabToday = await get(
    `SELECT current_step FROM vocab_sessions WHERE user_id = ? AND date = ?`,
    [userId, today]
  );
  const vocabCompleted = await get(
    `SELECT COUNT(DISTINCT date) as completed_count FROM vocab_sessions WHERE user_id = ? AND current_step = 'done'`,
    [userId]
  );

  const vocabDoneToday = vocabToday?.current_step === "done";
  const vocabStars = Number(vocabCompleted?.completed_count || 0);
  const grammarDoneSessions = await all(
    `SELECT current_step, grammar_info FROM grammar_sessions WHERE user_id = ?`,
    [userId]
  );
  const grammarStars = grammarDoneSessions.reduce((sum, row) => {
    try {
      const parsed = JSON.parse(row.grammar_info || "{}");
      const earned = Math.max(0, Number(parsed.stars || 0));
      const completionFloor = row.current_step === "done" ? 1 : 0;
      return sum + Math.max(earned, completionFloor);
    } catch {
      return sum;
    }
  }, 0);

  const readingDoneSessions = await all(
    `SELECT current_step, reading_info FROM reading_sessions WHERE user_id = ?`,
    [userId]
  );
  const readingStars = readingDoneSessions.reduce((sum, row) => {
    try {
      const parsed = JSON.parse(row.reading_info || "{}");
      const earned = Math.max(0, Number(parsed.stars || 0));
      const completionFloor = row.current_step === "done" ? 1 : 0;
      return sum + Math.max(earned, completionFloor);
    } catch {
      return sum;
    }
  }, 0);
  const bonusStars = Number(user?.bonus_stars || 0);
  const totalStars = completedSessions + vocabStars + grammarStars + readingStars + bonusStars;

  const weeklyRows = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const row = await get(
      `SELECT current_step FROM sessions WHERE user_id = ? AND date = ?`,
      [userId, date]
    );
    const started = Boolean(row);
    const done = row?.current_step === "done";
    const score = done ? 100 : started ? 55 : 0;
    weeklyRows.push({ date, score, started, done });
  }
  const nonZero = weeklyRows.filter((r) => r.score > 0);
  const avgScore = nonZero.length
    ? Math.round(nonZero.reduce((sum, r) => sum + r.score, 0) / nonZero.length)
    : 0;
  const weeklyStartedCount = weeklyRows.filter((r) => r.started).length;

  const estimatedBand = Number(user?.estimated_band || 4);
  const weekImprovement = Math.max(2, Math.min(12, Math.round((avgScore - 50) / 4)));
  const accessStatus = getAccessStatus(user?.created_at);
  const referralRows = await all(
    `SELECT sr.reward_status, sr.created_at, u.name, u.email
     FROM student_referrals sr
     JOIN users u ON u.id = sr.referred_user_id
     WHERE sr.referrer_user_id = ?
     ORDER BY sr.created_at DESC
     LIMIT 5`,
    [userId]
  );
  const referralStats = referralRows.reduce(
    (acc, row) => {
      if (row.reward_status === "granted") acc.granted += 1;
      else acc.pending += 1;
      return acc;
    },
    { total: referralRows.length, granted: 0, pending: 0 }
  );

  res.json({
    day_index: dayIndex,
    total_days: 14,
    focus: "Writing Focus",
    today_started: todayStarted,
    today_done: todayRow?.current_step === "done",
    completed_days: completedSessions,
    completion_rate: Math.round((completedSessions / 14) * 100),
    total_stars: totalStars,
    bonus_stars: bonusStars,
    access_days_total: accessStatus.access_days_total,
    access_days_left: accessStatus.access_days_left,
    access_label: accessStatus.access_label,
    referral_code: referralCode,
    referred_by_code: user?.referred_by_code || "",
    school_name: user?.school_name || "",
    grammar_total_stars: grammarStars,
    reading_total_stars: readingStars,
    vocab_today_done: vocabDoneToday,
    vocab_total_stars: vocabStars,
    estimated_band: estimatedBand,
    weekly_activity: weeklyRows,
    weekly_sessions: weeklyStartedCount,
    avg_score: avgScore,
    week_improvement: weekImprovement,
    referral_stats: referralStats,
    recent_referrals: referralRows.map((row) => ({
      name: row.name || row.email || "New student",
      email: row.email || "",
      reward_status: row.reward_status || "pending",
      created_at: row.created_at || ""
    }))
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
