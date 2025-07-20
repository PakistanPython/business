import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('loans')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('business_id', 'integer', (col) => col.references('users.id').onDelete('cascade').notNull())
    .addColumn('lender_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('principal_amount', 'decimal(12, 2)', (col) => col.notNull())
    .addColumn('current_balance', 'decimal(12, 2)', (col) => col.notNull())
    .addColumn('interest_rate', 'decimal(5, 2)')
    .addColumn('monthly_payment', 'decimal(10, 2)')
    .addColumn('loan_type', 'varchar(50)', (col) => col.notNull())
    .addColumn('start_date', 'date', (col) => col.notNull())
    .addColumn('due_date', 'date')
    .addColumn('status', 'varchar(50)', (col) => col.notNull().defaultTo('active'))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('loans').execute();
}
