import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change_me";

export function requireTeacher(req, res, next) {
  const token = req.cookies?.teacher_token;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload?.role !== "teacher") return res.status(403).json({ error: "forbidden" });
    req.teacher = payload;
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}
