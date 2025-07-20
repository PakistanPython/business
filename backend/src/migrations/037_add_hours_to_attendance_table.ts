import { pool } from '../config/database';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE attendance
      ADD COLUMN total_hours DECIMAL(5, 2) DEFAULT 0,
      ADD COLUMN overtime_hours DECIMAL(5, 2) DEFAULT 0
    `);

    await client.query('COMMIT');
    console.log('Attendance table updated with hours columns successfully');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE attendance
      DROP COLUMN total_hours,
      DROP COLUMN overtime_hours
    `);

    await client.query('COMMIT');
    console.log('Attendance table reverted successfully');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};
