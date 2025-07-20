import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('loan_payments')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('loan_id', 'integer', (col) => col.references('loans.id').onDelete('cascade').notNull())
    .addColumn('amount', 'decimal(12, 2)', (col) => col.notNull())
    .addColumn('payment_date', 'date', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('loan_payments').execute();
}
