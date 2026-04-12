import { pool } from '../config/database';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE employee_work_schedules
      ADD COLUMN IF NOT EXISTS late_come_threshold_minutes INTEGER DEFAULT 15,
      ADD COLUMN IF NOT EXISTS half_day_hours NUMERIC(5, 2) DEFAULT 4
    `);

    await client.query(`
      UPDATE employee_work_schedules
      SET late_come_threshold_minutes = COALESCE(late_come_threshold_minutes, 15),
          half_day_hours = COALESCE(half_day_hours, 4)
    `);

    console.log('Added late come and half day thresholds to work schedules');
  } finally {
    client.release();
  }
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE employee_work_schedules
      DROP COLUMN IF EXISTS late_come_threshold_minutes,
      DROP COLUMN IF EXISTS half_day_hours
    `);

    console.log('Removed late come and half day thresholds from work schedules');
  } finally {
    client.release();
  }
};