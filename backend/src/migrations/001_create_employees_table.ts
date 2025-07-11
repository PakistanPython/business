import { db } from '../config/database';

export const up = async () => {
  await new Promise<void>((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        created_by_user_id INTEGER,
        employee_code TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

export const down = async () => {
  await new Promise<void>((resolve, reject) => {
    db.run(`DROP TABLE IF EXISTS employees`, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
