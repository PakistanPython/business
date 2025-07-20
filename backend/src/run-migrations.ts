import { pool, testConnection } from './config/database';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const runMigrations = async () => {
  try {
    await testConnection();
    console.log('Running migrations...');

    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.ts'))
      .sort();

    for (const file of migrationFiles) {
      const migration = await import(path.join(migrationsDir, file));
      if (typeof migration.up === 'function') {
        console.log(`Running migration: ${file}`);
        await migration.up();
      }
    }

    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    pool.end();
  }
};

runMigrations();
