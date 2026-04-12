"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(db) {
    await db.schema
        .alterTable('payroll')
        .addColumn('business_id', 'integer', (col) => col.references('businesses.id').onDelete('cascade'))
        .execute();
    await db
        .updateTable('payroll')
        .set({ business_id: 1 })
        .where('business_id', 'is', null)
        .execute();
    await db.schema
        .alterTable('payroll')
        .alterColumn('business_id', (col) => col.setNotNull())
        .execute();
}
async function down(db) {
    await db.schema.alterTable('payroll').dropColumn('business_id').execute();
}
