"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('loan_payments')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('loan_id', 'integer', (col) => col.references('loans.id').onDelete('cascade').notNull())
        .addColumn('amount', 'decimal(12, 2)', (col) => col.notNull())
        .addColumn('payment_date', 'date', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo((0, kysely_1.sql) `now()`).notNull())
        .execute();
}
async function down(db) {
    await db.schema.dropTable('loan_payments').execute();
}
