// saveTask.js
const db = require("./database");

function saveTaskToDB(taskData) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO tasks (
        name, current_date, start_date, stop_date,
        active_time, idle_time, task_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
      sql,
      [
        taskData.name,
        taskData.current_date,
        taskData.start_date,
        taskData.stop_date,
        taskData.active_time,
        taskData.idle_time,
        taskData.task_status ? 1 : 0, // SQLite doesn't have BOOLEAN, use 1/0
      ],
      function (err) {
        if (err) {
          console.error("❌ Failed to insert task:", err.message);
          reject(err);
        } else {
          console.log("✅ Task saved to DB with ID:", this.lastID);
          resolve({ success: true, task_id: this.lastID });
        }
      }
    );
  });
}

module.exports = { saveTaskToDB };
