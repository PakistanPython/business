import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('accounts')
    .addColumn('bank_name', 'varchar(100)')
    .execute();

  await db.schema
    .alterTable('accounts')
    .addColumn('account_number', 'varchar(50)')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('accounts')
    .dropColumn('bank_name')
    .execute();
  
  await db.schema
    .alterTable('accounts')
    .dropColumn('account_number')
    .execute();
}
