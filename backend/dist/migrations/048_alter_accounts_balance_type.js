"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const database_1 = require("../config/database");
const up = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`
      ALTER TABLE accounts
      ALTER COLUMN balance TYPE DECIMAL(15, 2)
    `);
        console.log('Accounts table altered to change balance column type successfully');
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
      ALTER TABLE accounts
      ALTER COLUMN balance TYPE REAL
    `);
        console.log('Accounts table reverted to change balance column type successfully');
    }
    finally {
        client.release();
    }
};
exports.down = down;
