"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const kysely_1 = require("kysely");
async function up(db) {
    await db.schema
        .createTable('charity_payments')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('charity_id', 'integer', (col) => col.references('charity.id').onDelete('cascade').notNull())
        .addColumn('business_id', 'integer', (col) => col.references('users.id').onDelete('cascade').notNull())
        .addColumn('payment_amount', 'decimal(10, 2)', (col) => col.notNull())
        .addColumn('payment_date', 'date', (col) => col.notNull())
        .addColumn('recipient', 'varchar(255)')
        .addColumn('description', 'text')
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo((0, kysely_1.sql) `CURRENT_TIMESTAMP`).notNull())
        .addColumn('updated_at', 'timestamp', (col) => col.defaultTo((0, kysely_1.sql) `CURRENT_TIMESTAMP`).notNull())
        .execute();
}
async function down(db) {
    await db.schema.dropTable('charity_payments').execute();
}
