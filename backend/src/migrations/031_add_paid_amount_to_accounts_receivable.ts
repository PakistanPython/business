import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('accounts_receivable')
    .addColumn('paid_amount', 'decimal(10, 2)', (col) => col.defaultTo(0.00))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('accounts_receivable')
    .dropColumn('paid_amount')
    .execute();
}
