import { db } from '../config/database';

export const up = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        business_id INTEGER,
        employee_id VARCHAR(20) UNIQUE NOT NULL,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20),
        position VARCHAR(100),
        department VARCHAR(100),
        hire_date DATE NOT NULL,
        salary DECIMAL(15,2),
        hourly_rate DECIMAL(10,2),
        employment_type VARCHAR(20) DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract')),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
        password_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Employees table created successfully');
  } catch (error) {
    console.error('❌ Error creating employees table:', error);
    throw error;
  }
};

export const down = async () => {
  try {
    await db.query(`DROP TABLE IF EXISTS employees CASCADE`);
    console.log('✅ Employees table dropped successfully');
  } catch (error) {
    console.error('❌ Error dropping employees table:', error);
    throw error;
  }
};

