import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('sales')
    .addColumn('purchase_id', 'integer', (col) =>
      col.references('purchases.id').onDelete('set null')
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('sales').dropColumn('purchase_id').execute();
}
