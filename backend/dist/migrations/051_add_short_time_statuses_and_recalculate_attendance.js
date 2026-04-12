"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const database_1 = require("../config/database");
const attendance_recalculation_1 = require("../utils/attendance_recalculation");
const up = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check`);
        await client.query(`
      ALTER TABLE attendance
      ADD CONSTRAINT attendance_status_check
      CHECK (status IN ('present', 'absent', 'late', 'short_time', 'late_short_time', 'holiday', 'half_day'))
    `);
    }
    finally {
        client.release();
    }
    await (0, attendance_recalculation_1.recalculateAllAttendanceStatuses)();
    console.log('Added short time attendance statuses and recalculated existing attendance');
};
exports.up = up;
const down = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check`);
        await client.query(`
      ALTER TABLE attendance
      ADD CONSTRAINT attendance_status_check
      CHECK (status IN ('present', 'absent', 'late', 'holiday', 'half_day'))
    `);
    }
    finally {
        client.release();
    }
};
exports.down = down;
