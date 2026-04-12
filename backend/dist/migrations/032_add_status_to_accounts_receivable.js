"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('accounts_receivable')
        .addColumn('status', 'varchar(20)', (col) => col.defaultTo('pending'))
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('accounts_receivable')
        .dropColumn('status')
        .execute();
}
