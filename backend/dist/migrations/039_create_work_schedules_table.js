"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('work_schedules')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('employee_id', 'integer', (col) => col.references('employees.id').onDelete('cascade').notNull())
        .addColumn('day_of_week', 'integer', (col) => col.notNull())
        .addColumn('start_time', 'time', (col) => col.notNull())
        .addColumn('end_time', 'time', (col) => col.notNull())
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo((0, kysely_1.sql) `CURRENT_TIMESTAMP`))
        .execute();
}
async function down(db) {
    await db.schema.dropTable('work_schedules').execute();
}
