// database.js
const Database = require("better-sqlite3");
const path = require("path");

// Create or open the database
const db = new Database(path.join(__dirname, "tasks.db"));
console.log("✅ Connected to SQLite database (better-sqlite3)");

// Create tasks table if it doesn't exist
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS tasks (
    task_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    current_date TEXT,
    start_date TEXT,
    stop_date TEXT,
    duration_time TEXT,
    idle_time TEXT,
    task_status BOOLEAN
  )
`
).run();

module.exports = db;
