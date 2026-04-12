"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('sales')
        .addColumn('purchase_id', 'integer', (col) => col.references('purchases.id').onDelete('set null'))
        .execute();
}
async function down(db) {
    await db.schema.alterTable('sales').dropColumn('purchase_id').execute();
}
