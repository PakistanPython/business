import { pool } from '../config/database';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE accounts
      ALTER COLUMN balance TYPE DECIMAL(15, 2)
    `);
    console.log('Accounts table altered to change balance column type successfully');
  } finally {
    client.release();
  }
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE accounts
      ALTER COLUMN balance TYPE REAL
    `);
    console.log('Accounts table reverted to change balance column type successfully');
  } finally {
    client.release();
  }
};
