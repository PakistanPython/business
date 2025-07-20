import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('sales')
    .addColumn('payment_method', 'varchar(50)')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('sales').dropColumn('payment_method').execute();
}
