import { Pool } from 'pg';
import dotenv from 'dotenv';

// Create PostgreSQL connection pool for Supabase
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? true : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test the connection
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ Supabase database connected successfully');
    console.log('💾 Database: PostgreSQL/Supabase');
  } catch (err) {
    console.error('❌ Supabase connection failed:', err);
    console.log('⚠️ Continuing without database connection for development');
    // Don't exit process in development
  }
};

// Helper function to run queries that return data
export const dbGet = async (sql: string, params: any[] = []): Promise<any> => {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

// Helper function to run queries that return multiple rows
export const dbAll = async (sql: string, params: any[] = []): Promise<any[]> => {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows || [];
  } finally {
    client.release();
  }
};

// Helper function to run insert/update/delete queries
export const dbRun = async (sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> => {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return { 
      lastID: result.rows[0]?.id || result.rowCount,
      changes: result.rowCount || 0 
    };
  } finally {
    client.release();
  }
};

// Helper function for transactions
export const dbTransaction = async (callback: (client: any) => Promise<any>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});
