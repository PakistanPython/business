import { pool } from '../config/database';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_work_schedules (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        business_id INTEGER NOT NULL,
        schedule_name TEXT NOT NULL,
        effective_from DATE NOT NULL,
        effective_to DATE,
        monday_start TIME,
        monday_end TIME,
        tuesday_start TIME,
        tuesday_end TIME,
        wednesday_start TIME,
        wednesday_end TIME,
        thursday_start TIME,
        thursday_end TIME,
        friday_start TIME,
        friday_end TIME,
        saturday_start TIME,
        saturday_end TIME,
        sunday_start TIME,
        sunday_end TIME,
        break_duration INTEGER,
        weekly_hours NUMERIC,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('Work Schedules table created successfully');
  } finally {
    client.release();
  }
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS employee_work_schedules`);
    console.log('Work Schedules table dropped successfully');
  } finally {
    client.release();
  }
};
