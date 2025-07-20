import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('sales')
    .addColumn('selling_price', 'decimal(10, 2)', (col) => col.notNull().defaultTo(0))
    .execute();

  await db.schema
    .alterTable('sales')
    .addColumn('status', 'varchar(20)', (col) => col.notNull().defaultTo('completed'))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('sales').dropColumn('selling_price').execute();
  await db.schema.alterTable('sales').dropColumn('status').execute();
}
