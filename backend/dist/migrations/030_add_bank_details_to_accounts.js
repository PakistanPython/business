"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('accounts')
        .addColumn('bank_name', 'varchar(100)')
        .execute();
    await db.schema
        .alterTable('accounts')
        .addColumn('account_number', 'varchar(50)')
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('accounts')
        .dropColumn('bank_name')
        .execute();
    await db.schema
        .alterTable('accounts')
        .dropColumn('account_number')
        .execute();
}
