import { up as createEmployeesTable } from './migrations/001_create_employees_table';
import { db } from './config/database';

const runMigrations = async () => {
  try {
    console.log('Running migrations...');
    await createEmployeesTable();
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    db.close();
  }
};

runMigrations();
