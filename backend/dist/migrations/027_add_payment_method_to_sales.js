"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('sales')
        .addColumn('payment_method', 'varchar(50)')
        .execute();
}
async function down(db) {
    await db.schema.alterTable('sales').dropColumn('payment_method').execute();
}
