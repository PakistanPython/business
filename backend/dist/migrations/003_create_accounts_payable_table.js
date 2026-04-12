"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const database_1 = require("../config/database");
const up = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS accounts_payable (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL,
        vendor_name TEXT NOT NULL,
        amount REAL NOT NULL,
        due_date DATE NOT NULL,
        paid BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
        console.log('Accounts Payable table created successfully');
    }
    finally {
        client.release();
    }
};
exports.up = up;
const down = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`DROP TABLE IF EXISTS accounts_payable`);
        console.log('Accounts Payable table dropped successfully');
    }
    finally {
        client.release();
    }
};
exports.down = down;
