"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./config/database");
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const runMigrations = async () => {
    try {
        await (0, database_1.testConnection)();
        console.log('Running migrations...');
        await (0, database_1.dbRun)(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
        const executedMigrations = await (0, database_1.dbAll)('SELECT name FROM migrations');
        const executedMigrationNames = new Set(executedMigrations.map((m) => m.name));
        const migrationsDir = path_1.default.join(__dirname, 'migrations');
        const migrationFiles = fs_1.default.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
            .sort();
        for (const file of migrationFiles) {
            if (!executedMigrationNames.has(file)) {
                try {
                    const migration = await Promise.resolve(`${path_1.default.join(migrationsDir, file)}`).then(s => __importStar(require(s)));
                    if (typeof migration.up === 'function') {
                        console.log(`Running migration: ${file}`);
                        await migration.up(database_1.db);
                        await (0, database_1.dbRun)('INSERT INTO migrations (name) VALUES ($1)', [file]);
                    }
                }
                catch (error) {
                    if (error.code === '42701') {
                        console.log(`Column in ${file} already exists, marking as migrated.`);
                        await (0, database_1.dbRun)('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [file]);
                    }
                    else {
                        throw error;
                    }
                }
            }
        }
        console.log('Migrations completed successfully.');
    }
    catch (error) {
        console.error('Error running migrations:', error);
        process.exit(1);
    }
    finally {
        database_1.pool.end();
    }
};
runMigrations();
