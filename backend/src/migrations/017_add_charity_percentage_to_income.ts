import { pool } from '../config/database';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE income
      ADD COLUMN IF NOT EXISTS charity_percentage DECIMAL(5, 2) DEFAULT 0.00
    `);
    console.log('charity_percentage column added to income table successfully');
  } finally {
    client.release();
  }
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE income
      DROP COLUMN charity_percentage
    `);
    console.log('charity_percentage column dropped from income table successfully');
  } finally {
    client.release();
  }
};
