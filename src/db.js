import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envDbPath = process.env.DB_PATH;
const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH;
const resolvedDbPath = envDbPath
  ? envDbPath
  : volumePath
    ? path.join(volumePath, "data.sqlite")
    : path.join(__dirname, "..", "data.sqlite");

const DB_PATH = resolvedDbPath;

const dbDir = path.dirname(DB_PATH);
try {
  fs.mkdirSync(dbDir, { recursive: true });
} catch {
  // ignore
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    form INTEGER NOT NULL,
    estimated_band REAL NOT NULL,
    weaknesses TEXT NOT NULL,
    strengths TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  db.all("PRAGMA table_info(users)", (err, rows) => {
    if (err) return;
    const cols = new Set(rows.map((r) => r.name));
    if (!cols.has("class_name")) {
      db.run("ALTER TABLE users ADD COLUMN class_name TEXT");
    }
    if (!cols.has("teacher_name")) {
      db.run("ALTER TABLE users ADD COLUMN teacher_name TEXT");
    }
    if (!cols.has("teacher_id")) {
      db.run("ALTER TABLE users ADD COLUMN teacher_id TEXT");
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    current_step TEXT NOT NULL,
    today_focus TEXT NOT NULL,
    content TEXT NOT NULL,
    core_answer TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    step TEXT NOT NULL,
    prompt_json TEXT NOT NULL,
    model_json TEXT NOT NULL,
    student_answer TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS weekly_checkpoints (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    prompt_json TEXT NOT NULL,
    student_answer TEXT,
    feedback_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    english_question TEXT NOT NULL,
    quick_tip TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS vocab_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    current_step TEXT NOT NULL,
    target_word TEXT NOT NULL,
    word_info TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS vocab_responses (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    step TEXT NOT NULL,
    prompt_json TEXT NOT NULL,
    model_json TEXT NOT NULL,
    student_answer TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES vocab_sessions(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS essay_uploads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    original_name TEXT NOT NULL,
    extracted_text TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function close() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
