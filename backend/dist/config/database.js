"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbTransaction = exports.dbRun = exports.dbAll = exports.dbGet = exports.testConnection = exports.db = exports.pool = void 0;
const pg_1 = require("pg");
const kysely_1 = require("kysely");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
exports.pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? true : { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});
exports.db = new kysely_1.Kysely({
    dialect: new kysely_1.PostgresDialect({ pool: exports.pool }),
});
const testConnection = async () => {
    try {
        console.log('Attempting to connect with connection string:', process.env.DATABASE_URL || process.env.POSTGRES_URL);
        const client = await exports.pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('✅ Supabase database connected successfully');
        console.log('💾 Database: PostgreSQL/Supabase');
    }
    catch (err) {
        console.error('❌ Supabase connection failed:', err);
        console.log('⚠️ Continuing without database connection for development');
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
            lastID: result.rows && result.rows.length > 0 ? result.rows[0].id : undefined,
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
