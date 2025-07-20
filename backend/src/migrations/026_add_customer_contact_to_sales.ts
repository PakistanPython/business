import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('sales')
    .addColumn('customer_contact', 'varchar(255)')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('sales').dropColumn('customer_contact').execute();
}
