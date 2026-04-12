"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('sales')
        .addColumn('customer_contact', 'varchar(255)')
        .execute();
}
async function down(db) {
    await db.schema.alterTable('sales').dropColumn('customer_contact').execute();
}
