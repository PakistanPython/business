import { pool } from '../config/database';
import { recalculateAllAttendanceStatuses } from '../utils/attendance_recalculation';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check`);
    await client.query(`
      ALTER TABLE attendance
      ADD CONSTRAINT attendance_status_check
      CHECK (status IN ('present', 'absent', 'late', 'short_time', 'late_short_time', 'holiday', 'half_day'))
    `);
  } finally {
    client.release();
  }

  await recalculateAllAttendanceStatuses();
  console.log('Added short time attendance statuses and recalculated existing attendance');
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check`);
    await client.query(`
      ALTER TABLE attendance
      ADD CONSTRAINT attendance_status_check
      CHECK (status IN ('present', 'absent', 'late', 'holiday', 'half_day'))
    `);
  } finally {
    client.release();
  }
};