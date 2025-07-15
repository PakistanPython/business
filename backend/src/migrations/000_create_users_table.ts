import { pool } from '../config/database';

export const up = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const columns = [
      { name: 'is_active', type: 'BOOLEAN DEFAULT TRUE' },
      { name: 'user_type', type: 'TEXT' },
      { name: 'business_id', type: 'INTEGER' }
    ];

    for (const column of columns) {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='${column.name}') THEN
            ALTER TABLE users ADD COLUMN ${column.name} ${column.type};
          END IF;
        END $$;
      `);
    }
    console.log('Users table created/updated successfully');
  } finally {
    client.release();
  }
};

export const down = async () => {
  const client = await pool.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS users`);
    console.log('Users table dropped successfully');
  } finally {
    client.release();
  }
};
