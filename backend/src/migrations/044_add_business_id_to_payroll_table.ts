import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('payroll')
    .addColumn('business_id', 'integer', (col) =>
      col.references('businesses.id').onDelete('cascade')
    )
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

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('payroll').dropColumn('business_id').execute();
}
