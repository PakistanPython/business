"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const database_1 = require("../config/database");
const up = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`DROP TABLE IF EXISTS charity;`);
        await client.query(`
      CREATE TABLE charity (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL,
        income_id INTEGER,
        amount_required NUMERIC(10, 2) NOT NULL,
        amount_paid NUMERIC(10, 2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'pending', -- pending, partial, paid
        description TEXT,
        recipient VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (income_id) REFERENCES income(id) ON DELETE SET NULL
      );
    `);
        console.log('Charity table recreated successfully');
    }
    finally {
        client.release();
    }
};
exports.up = up;
const down = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`DROP TABLE IF EXISTS charity;`);
        console.log('Charity table dropped successfully');
    }
    finally {
        client.release();
    }
};
exports.down = down;
