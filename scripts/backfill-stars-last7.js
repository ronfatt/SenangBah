import { all, run, close } from "../src/db.js";

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function computeGrammarStars(info) {
  const existing = Math.max(0, toNum(info?.stars));
  const answered = info?.answered && typeof info.answered === "object" ? Object.values(info.answered) : [];
  const finalCorrect = answered.filter((x) => Boolean(x?.final_correct)).length;
  return Math.max(existing, finalCorrect, 1);
}

function computeReadingStars(info) {
  const existing = Math.max(0, toNum(info?.stars));
  const answered = info?.answered && typeof info.answered === "object" ? Object.values(info.answered) : [];
  const correct = answered.filter((x) => Boolean(x?.correct)).length;
  return Math.max(existing, correct, 1);
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

async function backfill() {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  const sinceDate = formatDate(since);

  const grammarRows = await all(
    `SELECT g.id, g.user_id, g.date, g.grammar_info, u.name, u.email
     FROM grammar_sessions g
     LEFT JOIN users u ON u.id = g.user_id
     WHERE g.current_step = 'done' AND g.date >= ?`,
    [sinceDate]
  );

  const readingRows = await all(
    `SELECT r.id, r.user_id, r.date, r.reading_info, u.name, u.email
     FROM reading_sessions r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.current_step = 'done' AND r.date >= ?`,
    [sinceDate]
  );

  let grammarPatched = 0;
  let readingPatched = 0;
  const touchedUsers = new Map();

  await run("BEGIN");
  try {
    for (const row of grammarRows) {
      let info;
      try {
        info = JSON.parse(row.grammar_info || "{}");
      } catch {
        info = {};
      }
      const current = Math.max(0, toNum(info.stars));
      const target = computeGrammarStars(info);
      if (target > current) {
        info.stars = target;
        await run("UPDATE grammar_sessions SET grammar_info = ? WHERE id = ?", [JSON.stringify(info), row.id]);
        grammarPatched += 1;
        touchedUsers.set(row.user_id, `${row.name || ""} <${row.email || ""}>`.trim());
      }
    }

    for (const row of readingRows) {
      let info;
      try {
        info = JSON.parse(row.reading_info || "{}");
      } catch {
        info = {};
      }
      const current = Math.max(0, toNum(info.stars));
      const target = computeReadingStars(info);
      if (target > current) {
        info.stars = target;
        await run("UPDATE reading_sessions SET reading_info = ? WHERE id = ?", [JSON.stringify(info), row.id]);
        readingPatched += 1;
        touchedUsers.set(row.user_id, `${row.name || ""} <${row.email || ""}>`.trim());
      }
    }

    await run("COMMIT");
  } catch (err) {
    await run("ROLLBACK");
    throw err;
  }

  console.log(JSON.stringify({
    window_start_date: sinceDate,
    grammar_completed_rows: grammarRows.length,
    reading_completed_rows: readingRows.length,
    grammar_patched_rows: grammarPatched,
    reading_patched_rows: readingPatched,
    affected_students: touchedUsers.size,
    students: Array.from(touchedUsers.values()).sort()
  }, null, 2));
}

backfill()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await close();
  });
