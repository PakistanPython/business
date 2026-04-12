"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const database_1 = require("../config/database");
const up = async () => {
    await (0, database_1.dbRun)(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      email_notifications BOOLEAN DEFAULT TRUE,
      push_notifications BOOLEAN DEFAULT FALSE,
      weekly_reports BOOLEAN DEFAULT TRUE,
      monthly_summary BOOLEAN DEFAULT TRUE,
      currency TEXT DEFAULT 'USD',
      date_format TEXT DEFAULT 'MM/DD/YYYY',
      theme TEXT DEFAULT 'light',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);
};
exports.up = up;
const down = async () => {
    await (0, database_1.dbRun)('DROP TABLE IF EXISTS user_preferences');
};
exports.down = down;
