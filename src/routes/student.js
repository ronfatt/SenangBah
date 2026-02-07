import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { get } from "../db.js";

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
    weaknesses: JSON.parse(user.weaknesses || "[]"),
    strengths: JSON.parse(user.strengths || "[]")
  });
});

export default router;
