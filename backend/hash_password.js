const bcrypt = require('bcryptjs');

const password = 'simplepass123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
  } else {
    console.log('Password:', password);
    console.log('Hash:', hash);
  }
});