"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbRun = exports.dbAll = exports.dbGet = exports.testConnection = exports.db = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const dbPath = path_1.default.join(__dirname, '../../database.sqlite');
const dbDir = path_1.default.dirname(dbPath);
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
}
exports.db = new sqlite3_1.default.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ SQLite connection failed:', err.message);
        process.exit(1);
    }
    else {
        console.log('✅ SQLite database connected successfully');
    }
});
exports.db.run('PRAGMA foreign_keys = ON');
const testConnection = async () => {
    return new Promise((resolve, reject) => {
        exports.db.get('SELECT 1', (err) => {
            if (err) {
                console.error('❌ Database connection test failed:', err);
                reject(err);
            }
            else {
                console.log('✅ Database connection test successful');
                resolve();
            }
        });
    });
};
exports.testConnection = testConnection;
const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        exports.db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(row);
            }
        });
    });
};
exports.dbGet = dbGet;
const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        exports.db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows || []);
            }
        });
    });
};
exports.dbAll = dbAll;
const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        exports.db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
};
exports.dbRun = dbRun;
