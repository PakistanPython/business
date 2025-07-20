import { pool } from '../config/database';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE purchases
      ADD COLUMN category_id INTEGER,
      ADD CONSTRAINT fk_category
        FOREIGN KEY(category_id) 
        REFERENCES categories(id)
        ON DELETE SET NULL;
    `);
    console.log('Category ID column added to purchases table successfully');
  } finally {
    client.release();
  }
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE purchases
      DROP CONSTRAINT fk_category,
      DROP COLUMN category_id;
    `);
    console.log('Category ID column dropped from purchases table successfully');
  } finally {
    client.release();
  }
};
