import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('loans')
    .addColumn('business_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade').notNull()
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('loans').dropColumn('business_id').execute();
}
