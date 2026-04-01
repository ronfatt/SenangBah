import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const dbPath = path.join(rootDir, "data.sqlite");
const outputDir = path.join(rootDir, "supabase", "exports");

const tables = [
  "users",
  "teachers",
  "school_codes",
  "sessions",
  "responses",
  "weekly_checkpoints",
  "chat_messages",
  "vocab_sessions",
  "vocab_responses",
  "essay_uploads",
  "grammar_sessions",
  "grammar_responses",
  "reading_sessions",
  "reading_responses",
  "pilot_registrations",
  "register_examples"
];

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

async function exportTable(db, tableName) {
  const tableExists = await all(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName]
  );
  if (!tableExists.length) {
    return { tableName, rowCount: 0, filePath: null, skipped: true };
  }

  const rows = await all(db, `SELECT * FROM ${tableName}`);
  const columns = rows.length
    ? Object.keys(rows[0])
    : (await all(db, `PRAGMA table_info(${tableName})`)).map((col) => col.name);

  const lines = [columns.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => csvEscape(row[col])).join(","));
  }

  const filePath = path.join(outputDir, `${tableName}.csv`);
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return { tableName, rowCount: rows.length, filePath };
}

async function main() {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`SQLite database not found at ${dbPath}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const db = new sqlite3.Database(dbPath);

  try {
    const results = [];
    for (const tableName of tables) {
      results.push(await exportTable(db, tableName));
    }

    for (const result of results) {
      if (result.skipped) {
        console.log(`${result.tableName}: skipped (table not found)`);
      } else {
        console.log(`${result.tableName}: ${result.rowCount} rows -> ${result.filePath}`);
      }
    }
  } finally {
    await new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
