import { pool, testConnection, dbRun, dbAll, db } from './config/database';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const runMigrations = async () => {
  try {
    await testConnection();
    console.log('Running migrations...');

    // 1. Create migrations table if it doesn't exist
    await dbRun(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Get all executed migrations
    const executedMigrations = await dbAll('SELECT name FROM migrations');
    const executedMigrationNames = new Set(executedMigrations.map((m: any) => m.name));

    // 3. Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();

    // 4. Run pending migrations
    for (const file of migrationFiles) {
      if (!executedMigrationNames.has(file)) {
        try {
          const migration = await import(path.join(migrationsDir, file));
          if (typeof migration.up === 'function') {
            console.log(`Running migration: ${file}`);
            await migration.up(db);
            await dbRun('INSERT INTO migrations (name) VALUES ($1)', [file]);
          }
        } catch (error: any) {
          // If the error is that the column already exists, we can ignore it and record the migration
          if (error.code === '42701') {
            console.log(`Column in ${file} already exists, marking as migrated.`);
            await dbRun('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [file]);
          } else {
            throw error;
          }
        }
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
