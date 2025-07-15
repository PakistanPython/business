"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const database_1 = require("../config/database");
const up = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL,
        created_by_user_id INTEGER,
        employee_code TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        address TEXT,
        hire_date DATE NOT NULL,
        employment_type TEXT CHECK(employment_type IN ('full_time', 'part_time', 'contract', 'temporary', 'intern')) DEFAULT 'full_time',
        salary_type TEXT CHECK(salary_type IN ('monthly', 'daily', 'hourly')) DEFAULT 'monthly',
        base_salary REAL,
        daily_wage REAL,
        hourly_rate REAL,
        department TEXT,
        position TEXT,
        status TEXT CHECK(status IN ('active', 'inactive', 'on_leave', 'terminated')) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        password_hash TEXT,
        FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
        console.log('Employees table created successfully');
    }
    finally {
        client.release();
    }
};
exports.up = up;
const down = async () => {
    const client = await database_1.pool.connect();
    try {
        await client.query(`DROP TABLE IF EXISTS employees`);
        console.log('Employees table dropped successfully');
    }
    finally {
        client.release();
    }
};
exports.down = down;
