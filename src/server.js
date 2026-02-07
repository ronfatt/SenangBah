import dotenv from "dotenv";
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import trainingRoutes from "./routes/training.js";
import weeklyRoutes from "./routes/weekly.js";
import studentRoutes from "./routes/student.js";
import adminRoutes from "./routes/admin.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(express.static(publicDir));

app.use("/api/auth", authRoutes);
app.use("/api/training", trainingRoutes);
app.use("/api/weekly", weeklyRoutes);
app.use("/api", studentRoutes);
app.use("/api/admin", adminRoutes);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`SPM Writing MVP running on http://localhost:${PORT}`);
});
