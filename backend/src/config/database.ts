import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.business_POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export const db = pool;

export const testConnection = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL database connected successfully');
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err);
    process.exit(1);
  }
};

export const dbGet = async (sql: string, params: any[] = []): Promise<any> => {
  const { rows } = await pool.query(sql, params);
  return rows[0];
};

export const dbAll = async (sql: string, params: any[] = []): Promise<any[]> => {
  const { rows } = await pool.query(sql, params);
  return rows;
};

export const dbRun = async (sql: string, params: any[] = []): Promise<{ rows?: any[]; rowCount?: number }> => {
  const result = await pool.query(sql, params);
  return { rows: result.rows, rowCount: result.rowCount || 0 };
};


