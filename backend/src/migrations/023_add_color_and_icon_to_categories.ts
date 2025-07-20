import { pool } from '../config/database';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE categories
      ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
      ADD COLUMN icon VARCHAR(50) NOT NULL DEFAULT 'circle'
    `);
    console.log('Color and icon columns added to categories table successfully');
  } finally {
    client.release();
  }
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE categories
      DROP COLUMN color,
      DROP COLUMN icon
    `);
    console.log('Color and icon columns dropped from categories table successfully');
  } finally {
    client.release();
  }
};
