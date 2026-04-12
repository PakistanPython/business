"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const database_1 = require("../config/database");
const up = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`
      ALTER TABLE income
      ADD COLUMN IF NOT EXISTS source VARCHAR(255)
    `);
        console.log('source column added to income table successfully');
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
      ALTER TABLE income
      DROP COLUMN source
    `);
        console.log('source column dropped from income table successfully');
    }
    finally {
        client.release();
    }
};
exports.down = down;
