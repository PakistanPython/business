"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const database_1 = require("../config/database");
const up = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`
      ALTER TABLE categories
      ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
      ADD COLUMN icon VARCHAR(50) NOT NULL DEFAULT 'circle'
    `);
        console.log('Color and icon columns added to categories table successfully');
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
      ALTER TABLE categories
      DROP COLUMN color,
      DROP COLUMN icon
    `);
        console.log('Color and icon columns dropped from categories table successfully');
    }
    finally {
        client.release();
    }
};
exports.down = down;
