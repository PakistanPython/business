"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('users')
        .addColumn('last_login', 'timestamp')
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('users')
        .dropColumn('last_login')
        .execute();
}
