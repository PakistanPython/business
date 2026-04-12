"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const database_1 = require("../config/database");
const up = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_id INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
        await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='business_id') THEN
          ALTER TABLE users ADD COLUMN business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
        await client.query('COMMIT');
        console.log('Businesses table created and users table updated successfully');
    }
    catch (e) {
        await client.query('ROLLBACK');
        throw e;
    }
    finally {
        client.release();
    }
};
exports.up = up;
const down = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS business_id
    `);
        await client.query('DROP TABLE IF EXISTS businesses');
        await client.query('COMMIT');
        console.log('Businesses table dropped and users table reverted successfully');
    }
    catch (e) {
        await client.query('ROLLBACK');
        throw e;
    }
    finally {
        client.release();
    }
};
exports.down = down;
