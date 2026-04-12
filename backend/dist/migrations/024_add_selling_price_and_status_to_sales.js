"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('sales')
        .addColumn('selling_price', 'decimal(10, 2)', (col) => col.notNull().defaultTo(0))
        .execute();
    await db.schema
        .alterTable('sales')
        .addColumn('status', 'varchar(20)', (col) => col.notNull().defaultTo('completed'))
        .execute();
}
async function down(db) {
    await db.schema.alterTable('sales').dropColumn('selling_price').execute();
    await db.schema.alterTable('sales').dropColumn('status').execute();
}
