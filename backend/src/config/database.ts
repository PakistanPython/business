import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = path.join(__dirname, '../../database.sqlite');
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create SQLite database connection
export const db: Database = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ SQLite connection failed:', err.message);
    process.exit(1);
  } else {
    console.log('✅ SQLite database connected successfully');
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Test the connection
export const testConnection = async () => {
  return new Promise<void>((resolve, reject) => {
    db.get('SELECT 1', (err) => {
      if (err) {
        console.error('❌ Database connection test failed:', err);
        reject(err);
      } else {
        console.log('✅ Database connection test successful');
        resolve();
      }
    });
  });
};


// Helper function to run queries that return data
export const dbGet = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Helper function to run queries that return multiple rows
export const dbAll = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Helper function to run insert/update/delete queries
export const dbRun = (sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};
