import { pool } from '../config/database';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Rename column
    await client.query('ALTER TABLE attendance_rules RENAME COLUMN late_threshold_minutes TO late_grace_period');

    // Add new columns
    await client.query(`
      ALTER TABLE attendance_rules
      ADD COLUMN late_penalty_type VARCHAR(50) DEFAULT 'none',
      ADD COLUMN late_penalty_amount DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN half_day_threshold INTEGER,
      ADD COLUMN overtime_threshold INTEGER,
      ADD COLUMN overtime_rate DECIMAL(5, 2) DEFAULT 1.5,
      ADD COLUMN min_working_hours INTEGER,
      ADD COLUMN max_working_hours INTEGER,
      ADD COLUMN auto_clock_out BOOLEAN DEFAULT false,
      ADD COLUMN auto_clock_out_time TIME,
      ADD COLUMN weekend_overtime BOOLEAN DEFAULT false,
      ADD COLUMN holiday_overtime BOOLEAN DEFAULT false,
      ADD COLUMN is_active BOOLEAN DEFAULT true
    `);

    // Drop old columns
    await client.query('ALTER TABLE attendance_rules DROP COLUMN early_leave_threshold_minutes');
    await client.query('ALTER TABLE attendance_rules DROP COLUMN overtime_start_hour');

    await client.query('COMMIT');
    console.log('Attendance Rules table updated successfully');
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

    // Revert column rename
    await client.query('ALTER TABLE attendance_rules RENAME COLUMN late_grace_period TO late_threshold_minutes');

    // Drop new columns
    await client.query(`
      ALTER TABLE attendance_rules
      DROP COLUMN late_penalty_type,
      DROP COLUMN late_penalty_amount,
      DROP COLUMN half_day_threshold,
      DROP COLUMN overtime_threshold,
      DROP COLUMN overtime_rate,
      DROP COLUMN min_working_hours,
      DROP COLUMN max_working_hours,
      DROP COLUMN auto_clock_out,
      DROP COLUMN auto_clock_out_time,
      DROP COLUMN weekend_overtime,
      DROP COLUMN holiday_overtime,
      DROP COLUMN is_active
    `);

    // Add back old columns
    await client.query('ALTER TABLE attendance_rules ADD COLUMN early_leave_threshold_minutes INTEGER');
    await client.query('ALTER TABLE attendance_rules ADD COLUMN overtime_start_hour TIME');

    await client.query('COMMIT');
    console.log('Attendance Rules table reverted successfully');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};
