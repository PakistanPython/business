"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('loans')
        .addColumn('business_id', 'integer', (col) => col.references('users.id').onDelete('cascade').notNull())
        .execute();
}
async function down(db) {
    await db.schema.alterTable('loans').dropColumn('business_id').execute();
}
