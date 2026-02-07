import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change_me";

export function requireAdmin(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload?.role !== "admin") return res.status(403).json({ error: "forbidden" });
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}
