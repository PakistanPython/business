import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('charity_payments')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('charity_id', 'integer', (col) =>
      col.references('charity.id').onDelete('cascade').notNull()
    )
    .addColumn('business_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade').notNull()
    )
    .addColumn('payment_amount', 'decimal(10, 2)', (col) => col.notNull())
    .addColumn('payment_date', 'date', (col) => col.notNull())
    .addColumn('recipient', 'varchar(255)')
    .addColumn('description', 'text')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('charity_payments').execute();
}
