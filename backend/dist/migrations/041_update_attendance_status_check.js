"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .alterTable('attendance')
        .dropConstraint('attendance_status_check')
        .execute();
    await db.schema
        .alterTable('attendance')
        .addCheckConstraint('attendance_status_check', (0, kysely_1.sql) `status IN ('present', 'absent', 'late', 'short_time', 'late_short_time', 'holiday', 'half_day')`)
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('attendance')
        .dropConstraint('attendance_status_check')
        .execute();
    await db.schema
        .alterTable('attendance')
        .addCheckConstraint('attendance_status_check', (0, kysely_1.sql) `status IN ('present', 'absent', 'late', 'holiday')`)
        .execute();
}
