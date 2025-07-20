import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('accounts_receivable')
    .addColumn('customer_email', 'varchar(100)')
    .execute();

  await db.schema
    .alterTable('accounts_receivable')
    .addColumn('customer_phone', 'varchar(50)')
    .execute();

  await db.schema
    .alterTable('accounts_receivable')
    .addColumn('customer_address', 'text')
    .execute();

  await db.schema
    .alterTable('accounts_receivable')
    .addColumn('payment_terms', 'varchar(50)')
    .execute();

  await db.schema
    .alterTable('accounts_receivable')
    .addColumn('description', 'text')
    .execute();

  await db.schema
    .alterTable('accounts_receivable')
    .addColumn('notes', 'text')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('accounts_receivable')
    .dropColumn('customer_email')
    .execute();
  
  await db.schema
    .alterTable('accounts_receivable')
    .dropColumn('customer_phone')
    .execute();

  await db.schema
    .alterTable('accounts_receivable')
    .dropColumn('customer_address')
    .execute();

  await db.schema
    .alterTable('accounts_receivable')
    .dropColumn('payment_terms')
    .execute();

  await db.schema
    .alterTable('accounts_receivable')
    .dropColumn('description')
    .execute();

  await db.schema
    .alterTable('accounts_receivable')
    .dropColumn('notes')
    .execute();
}
