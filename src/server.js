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
import chatRoutes from "./routes/chat.js";
import vocabRoutes from "./routes/vocab.js";
import essayRoutes from "./routes/essay.js";
import teacherRoutes from "./routes/teacher.js";
import teacherExtraRoutes from "./routes/teacher-extra.js";
import grammarRoutes from "./routes/grammar.js";
import pilotRegisterRoutes from "./routes/pilot-register.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(express.static(publicDir));
const uploadDir = process.env.UPLOAD_DIR || (process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "uploads")
  : path.join(__dirname, "..", "uploads"));
app.use("/uploads", express.static(uploadDir));

app.use("/api/auth", authRoutes);
app.use("/api/training", trainingRoutes);
app.use("/api/weekly", weeklyRoutes);
app.use("/api", studentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/vocab", vocabRoutes);
app.use("/api/essay", essayRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/teacher", teacherExtraRoutes);
app.use("/api/grammar", grammarRoutes);
app.use("/api/pilot-registration", pilotRegisterRoutes);

app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

app.get("/teacher", (req, res) => {
  res.sendFile(path.join(publicDir, "teacher.html"));
});

app.get("/settings", (req, res) => {
  res.sendFile(path.join(publicDir, "settings.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(publicDir, "register.html"));
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`SPM Writing MVP running on http://localhost:${PORT}`);
});
