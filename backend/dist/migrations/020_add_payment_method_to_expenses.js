"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const database_1 = require("../config/database");
const up = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`
      ALTER TABLE expenses
      ADD COLUMN payment_method VARCHAR(255) NOT NULL DEFAULT 'Cash'
    `);
        console.log('Payment method column added to expenses table successfully');
    }
    finally {
        client.release();
    }
};
exports.up = up;
const down = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`
      ALTER TABLE expenses
      DROP COLUMN payment_method
    `);
        console.log('Payment method column dropped from expenses table successfully');
    }
    finally {
        client.release();
    }
};
exports.down = down;
