"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('charity')
        .addColumn('payment_date', 'date')
        .execute();
}
async function down(db) {
    await db.schema.alterTable('charity').dropColumn('payment_date').execute();
}
