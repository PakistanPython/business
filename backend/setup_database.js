const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  const pool = new Pool({
    connectionString: process.env.business_POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔗 Connecting to Supabase...');
    
    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to Supabase successfully');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📋 Creating database tables...');
    
    // Execute the SQL commands
    await pool.query(sql);
    
    console.log('✅ Database tables created successfully');
    console.log('🎉 Database setup completed!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();

