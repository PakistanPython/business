"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const database_1 = require("../config/database");
const up = async () => {
    const client = await database_1.pool.connect();
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
    }
    finally {
        client.release();
    }
};
exports.up = up;
const down = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`DROP TABLE IF EXISTS attendance_rules`);
        console.log('Attendance Rules table dropped successfully');
    }
    finally {
        client.release();
    }
};
exports.down = down;
