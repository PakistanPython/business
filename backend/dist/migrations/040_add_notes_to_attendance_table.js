"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('attendance')
        .addColumn('notes', 'text')
        .execute();
}
async function down(db) {
    await db.schema
        .alterTable('attendance')
        .dropColumn('notes')
        .execute();
}
