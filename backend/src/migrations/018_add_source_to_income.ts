import { pool } from '../config/database';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE income
      ADD COLUMN IF NOT EXISTS source VARCHAR(255)
    `);
    console.log('source column added to income table successfully');
  } finally {
    client.release();
  }
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE income
      DROP COLUMN source
    `);
    console.log('source column dropped from income table successfully');
  } finally {
    client.release();
  }
};
