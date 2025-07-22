import { dbRun } from '../config/database';

export const up = async () => {
  await dbRun(`
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

export const down = async () => {
  await dbRun('DROP TABLE IF EXISTS user_preferences');
};
