"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const database_1 = require("../config/database");
const up = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
      ALTER TABLE attendance
      ADD COLUMN total_hours DECIMAL(5, 2) DEFAULT 0,
      ADD COLUMN overtime_hours DECIMAL(5, 2) DEFAULT 0
    `);
        await client.query('COMMIT');
        console.log('Attendance table updated with hours columns successfully');
    }
    catch (e) {
        await client.query('ROLLBACK');
        throw e;
    }
    finally {
        client.release();
    }
};
exports.up = up;
const down = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
      ALTER TABLE attendance
      DROP COLUMN total_hours,
      DROP COLUMN overtime_hours
    `);
        await client.query('COMMIT');
        console.log('Attendance table reverted successfully');
    }
    catch (e) {
        await client.query('ROLLBACK');
        throw e;
    }
    finally {
        client.release();
    }
};
exports.down = down;
