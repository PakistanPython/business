"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbRun = exports.dbAll = exports.dbGet = exports.testConnection = exports.db = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new pg_1.Pool({
    connectionString: process.env.business_POSTGRES_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
exports.db = pool;
const testConnection = async () => {
    try {
        await pool.query('SELECT 1');
        console.log('✅ PostgreSQL database connected successfully');
    }
    catch (err) {
        console.error('❌ PostgreSQL connection failed:', err);
        process.exit(1);
    }
};
exports.testConnection = testConnection;
const dbGet = async (sql, params = []) => {
    const { rows } = await pool.query(sql, params);
    return rows[0];
};
exports.dbGet = dbGet;
const dbAll = async (sql, params = []) => {
    const { rows } = await pool.query(sql, params);
    return rows;
};
exports.dbAll = dbAll;
const dbRun = async (sql, params = []) => {
    const result = await pool.query(sql, params);
    return { rows: result.rows, rowCount: result.rowCount || 0 };
};
exports.dbRun = dbRun;
