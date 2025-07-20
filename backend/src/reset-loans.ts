import { Kysely } from 'kysely';
import { db } from './config/database';

async function resetLoansTable(db: Kysely<any>) {
  await db.schema.dropTable('loans').ifExists().execute();
  console.log('Loans table dropped');
  await db.deleteFrom('migrations').where('name', '=', '012_create_loans_table.ts').execute();
  console.log('Loans migration record deleted');
}

async function main() {
  try {
    await resetLoansTable(db);
  } catch (err) {
    console.error('Error resetting loans table:', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
