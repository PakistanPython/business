const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

// Get the stored hash from database
const db = new sqlite3.Database('./database.sqlite');

db.get("SELECT password_hash FROM employees WHERE email = 'john.doe@test.com'", (err, row) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  
  if (!row) {
    console.log('Employee not found');
    return;
  }
  
  const storedHash = row.password_hash;
  const testPassword = 'password123';
  
  console.log('Stored hash:', storedHash);
  console.log('Test password:', testPassword);
  
  bcrypt.compare(testPassword, storedHash, (err, result) => {
    if (err) {
      console.error('Bcrypt error:', err);
    } else {
      console.log('Password match:', result);
    }
    db.close();
  });
});