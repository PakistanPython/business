import { pool } from '../config/database';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance_rules (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL,
        rule_name TEXT NOT NULL,
        late_threshold_minutes INTEGER,
        early_leave_threshold_minutes INTEGER,
        overtime_start_hour TIME,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Attendance Rules table created successfully');
  } finally {
    client.release();
  }
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS attendance_rules`);
    console.log('Attendance Rules table dropped successfully');
  } finally {
    client.release();
  }
};
