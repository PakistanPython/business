import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('accounts_receivable')
    .addColumn('status', 'varchar(20)', (col) => col.defaultTo('pending'))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('accounts_receivable')
    .dropColumn('status')
    .execute();
}
