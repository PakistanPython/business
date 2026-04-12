"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('accounts_receivable')
        .addColumn('paid_amount', 'decimal(10, 2)', (col) => col.defaultTo(0.00))
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('accounts_receivable')
        .dropColumn('paid_amount')
        .execute();
}
