"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const database_1 = require("../config/database");
const up = async () => {
    const client = await database_1.pool.connect();
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
    }
    finally {
        client.release();
    }
};
exports.up = up;
const down = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`
      ALTER TABLE employee_work_schedules
      DROP COLUMN IF EXISTS late_come_threshold_minutes,
      DROP COLUMN IF EXISTS half_day_hours
    `);
        console.log('Removed late come and half day thresholds from work schedules');
    }
    finally {
        client.release();
    }
};
exports.down = down;
