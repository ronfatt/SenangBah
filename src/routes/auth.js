import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { run, get } from "../db.js";
import { nowIso } from "../utils.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "change_me";
const isProd = process.env.ENV === "production";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd
};

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, {
    expiresIn: "7d"
  });
}

router.post("/register", async (req, res) => {
  const {
    email,
    password,
    name,
    form = 5,
    estimated_band = 4,
    class_name = "",
    teacher_name = "",
    teacher_code = "",
    weaknesses = ["limited_vocab", "sentence_variety", "idea_development"],
    strengths = ["basic_grammar_ok"]
  } = req.body || {};

  if (!email || !password || !name) {
    return res.status(400).json({ error: "missing_fields" });
  }

  const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) return res.status(409).json({ error: "email_taken" });

  const hash = await bcrypt.hash(password, 10);
  const id = nanoid();

  let teacherId = null;
  if (teacher_code) {
    const normalized = String(teacher_code).trim().toUpperCase();
    const teacher = await get("SELECT id FROM teachers WHERE code = ?", [normalized]);
    if (!teacher) return res.status(400).json({ error: "invalid_teacher_code" });
    teacherId = teacher.id;
  }

  await run(
    `INSERT INTO users (id, email, password_hash, name, form, estimated_band, weaknesses, strengths, created_at, class_name, teacher_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
    [
      id,
      email,
      hash,
      name,
      form,
      estimated_band,
      JSON.stringify(weaknesses),
      JSON.stringify(strengths),
      nowIso(),
      class_name,
      teacher_name
    ]
  );

  if (teacherId) {
    await run("UPDATE users SET teacher_id = ? WHERE id = ?", [teacherId, id]);
  }

  const token = signToken({ id, email, name });
  res.cookie("token", token, cookieOptions);
  res.json({ ok: true });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "missing_fields" });

  const user = await get("SELECT * FROM users WHERE email = ?", [email]);
  if (!user) return res.status(401).json({ error: "invalid_credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = signToken(user);
  res.cookie("token", token, cookieOptions);
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

export default router;
