"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('users')
        .addColumn('full_name', 'varchar(255)')
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('users')
        .dropColumn('full_name')
        .execute();
}
