"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbTransaction = exports.dbRun = exports.dbAll = exports.dbGet = exports.testConnection = exports.pool = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
const testConnection = async () => {
    try {
        const client = await exports.pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('✅ Supabase database connected successfully');
    }
    catch (err) {
        console.error('❌ Supabase connection failed:', err);
        process.exit(1);
    }
};
exports.testConnection = testConnection;
const dbGet = async (sql, params = []) => {
    const client = await exports.pool.connect();
    try {
        const result = await client.query(sql, params);
        return result.rows[0] || null;
    }
    finally {
        client.release();
    }
};
exports.dbGet = dbGet;
const dbAll = async (sql, params = []) => {
    const client = await exports.pool.connect();
    try {
        const result = await client.query(sql, params);
        return result.rows || [];
    }
    finally {
        client.release();
    }
};
exports.dbAll = dbAll;
const dbRun = async (sql, params = []) => {
    const client = await exports.pool.connect();
    try {
        const result = await client.query(sql, params);
        return {
            lastID: result.rows[0]?.id || result.rowCount,
            changes: result.rowCount || 0
        };
    }
    finally {
        client.release();
    }
};
exports.dbRun = dbRun;
const dbTransaction = async (callback) => {
    const client = await exports.pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
};
exports.dbTransaction = dbTransaction;
process.on('SIGINT', async () => {
    console.log('Closing database pool...');
    await exports.pool.end();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('Closing database pool...');
    await exports.pool.end();
    process.exit(0);
});
