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
    school_code TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS school_codes (
    code TEXT PRIMARY KEY,
    school_name TEXT,
    created_at TEXT NOT NULL
  )`);

  db.all("PRAGMA table_info(teachers)", (err, rows) => {
    if (err) return;
    const cols = new Set(rows.map((r) => r.name));
    if (!cols.has("school_code")) {
      db.run("ALTER TABLE teachers ADD COLUMN school_code TEXT NOT NULL DEFAULT 'senang'");
    }
  });

  db.run(
    "INSERT OR IGNORE INTO school_codes (code, school_name, created_at) VALUES (?, ?, datetime('now'))",
    ["senang", "Default"]
  );

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

  db.run(`CREATE TABLE IF NOT EXISTS grammar_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    current_step TEXT NOT NULL,
    grammar_info TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS grammar_responses (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    step TEXT NOT NULL,
    prompt_json TEXT NOT NULL,
    model_json TEXT NOT NULL,
    student_answer TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES grammar_sessions(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pilot_registrations (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    full_name TEXT NOT NULL,
    age INTEGER NOT NULL,
    school_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    previous_result_type TEXT NOT NULL,
    previous_result TEXT NOT NULL,
    plan_choice TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  db.all("PRAGMA table_info(pilot_registrations)", (err, rows) => {
    if (err) return;
    const cols = new Set(rows.map((r) => r.name));
    if (!cols.has("self_intro_text")) {
      db.run("ALTER TABLE pilot_registrations ADD COLUMN self_intro_text TEXT NOT NULL DEFAULT ''");
    }
    if (!cols.has("self_intro_analysis_json")) {
      db.run("ALTER TABLE pilot_registrations ADD COLUMN self_intro_analysis_json TEXT");
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS register_examples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sort_order INTEGER NOT NULL UNIQUE,
    before_text TEXT NOT NULL,
    after_text TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(
    "INSERT OR IGNORE INTO register_examples (sort_order, before_text, after_text, updated_at) VALUES (?, ?, ?, datetime('now'))",
    [1, "I like study with my friends because fun.", "Studying with my friends keeps me motivated and improves my discipline."]
  );
  db.run(
    "INSERT OR IGNORE INTO register_examples (sort_order, before_text, after_text, updated_at) VALUES (?, ?, ?, datetime('now'))",
    [2, "English is hard and I cannot write good.", "English writing is challenging for me, but I am improving through daily short practice."]
  );
  db.run(
    "INSERT OR IGNORE INTO register_examples (sort_order, before_text, after_text, updated_at) VALUES (?, ?, ?, datetime('now'))",
    [3, "My goal is pass SPM only.", "My goal is to reach Band 6 so I can enter a better pre-university program."]
  );
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
