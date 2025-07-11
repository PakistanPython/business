"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _001_create_employees_table_1 = require("./migrations/001_create_employees_table");
const database_1 = require("./config/database");
const runMigrations = async () => {
    try {
        console.log('Running migrations...');
        await (0, _001_create_employees_table_1.up)();
        console.log('Migrations completed successfully.');
    }
    catch (error) {
        console.error('Error running migrations:', error);
        process.exit(1);
    }
    finally {
        database_1.db.close();
    }
};
runMigrations();
