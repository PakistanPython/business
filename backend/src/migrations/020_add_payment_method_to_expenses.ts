import { pool } from '../config/database';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE expenses
      ADD COLUMN payment_method VARCHAR(255) NOT NULL DEFAULT 'Cash'
    `);
    console.log('Payment method column added to expenses table successfully');
  } finally {
    client.release();
  }
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE expenses
      DROP COLUMN payment_method
    `);
    console.log('Payment method column dropped from expenses table successfully');
  } finally {
    client.release();
  }
};
