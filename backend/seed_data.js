const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const seedData = async () => {
  try {
    console.log('Starting to seed data...');
    
    const userId = 1; // Demo user ID
    
    // Insert income data
    const incomeData = [
      { amount: 5000, description: 'Monthly salary', category: 'Salary', source: 'Job', date: '2025-01-01' },
      { amount: 1500, description: 'Freelance project', category: 'Business', source: 'Freelance', date: '2025-01-05' },
      { amount: 800, description: 'Investment return', category: 'Investment', source: 'Stocks', date: '2025-01-10' },
      { amount: 5000, description: 'Monthly salary', category: 'Salary', source: 'Job', date: '2024-12-01' },
      { amount: 2000, description: 'Bonus', category: 'Salary', source: 'Job', date: '2024-12-15' },
      { amount: 5000, description: 'Monthly salary', category: 'Salary', source: 'Job', date: '2024-11-01' },
      { amount: 1200, description: 'Consulting work', category: 'Business', source: 'Consulting', date: '2024-11-10' }
    ];
    
    for (const income of incomeData) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO income (user_id, amount, description, category, source, date) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, income.amount, income.description, income.category, income.source, income.date],
          function(err) {
            if (err) reject(err);
            else {
              // Add transaction record
              db.run(
                'INSERT INTO transactions (user_id, transaction_type, reference_id, reference_table, amount, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, 'income', this.lastID, 'income', income.amount, income.description, income.date],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            }
          }
        );
      });
    }
    
    // Insert expense data
    const expenseData = [
      { amount: 800, description: 'Monthly rent', category: 'Housing', payment_method: 'Bank Transfer', date: '2025-01-01' },
      { amount: 300, description: 'Groceries', category: 'Food', payment_method: 'Cash', date: '2025-01-03' },
      { amount: 150, description: 'Fuel', category: 'Transport', payment_method: 'Credit Card', date: '2025-01-05' },
      { amount: 100, description: 'Electricity bill', category: 'Utilities', payment_method: 'Bank Transfer', date: '2025-01-07' },
      { amount: 200, description: 'Restaurant dinner', category: 'Food', payment_method: 'Credit Card', date: '2025-01-08' },
      { amount: 800, description: 'Monthly rent', category: 'Housing', payment_method: 'Bank Transfer', date: '2024-12-01' },
      { amount: 350, description: 'Groceries', category: 'Food', payment_method: 'Cash', date: '2024-12-05' },
      { amount: 180, description: 'Fuel', category: 'Transport', payment_method: 'Credit Card', date: '2024-12-10' },
      { amount: 800, description: 'Monthly rent', category: 'Housing', payment_method: 'Bank Transfer', date: '2024-11-01' },
      { amount: 320, description: 'Groceries', category: 'Food', payment_method: 'Cash', date: '2024-11-08' }
    ];
    
    for (const expense of expenseData) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO expenses (user_id, amount, description, category, payment_method, date) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, expense.amount, expense.description, expense.category, expense.payment_method, expense.date],
          function(err) {
            if (err) reject(err);
            else {
              // Add transaction record
              db.run(
                'INSERT INTO transactions (user_id, transaction_type, reference_id, reference_table, amount, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, 'expense', this.lastID, 'expenses', expense.amount, expense.description, expense.date],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            }
          }
        );
      });
    }
    
    // Insert purchase data
    const purchaseData = [
      { amount: 1000, description: 'Product inventory', category: 'Inventory', payment_method: 'Bank Transfer', date: '2024-12-15' },
      { amount: 500, description: 'Office supplies', category: 'Equipment', payment_method: 'Credit Card', date: '2024-12-20' },
      { amount: 800, description: 'Raw materials', category: 'Inventory', payment_method: 'Cash', date: '2025-01-02' }
    ];
    
    for (const purchase of purchaseData) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO purchases (user_id, amount, description, category, payment_method, date) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, purchase.amount, purchase.description, purchase.category, purchase.payment_method, purchase.date],
          function(err) {
            if (err) reject(err);
            else {
              // Add transaction record
              db.run(
                'INSERT INTO transactions (user_id, transaction_type, reference_id, reference_table, amount, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, 'purchase', this.lastID, 'purchases', purchase.amount, purchase.description, purchase.date],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            }
          }
        );
      });
    }
    
    // Insert sales data
    const salesData = [
      { amount: 1000, selling_price: 1500, description: 'Product sale', customer_name: 'Customer 1', payment_method: 'Cash', date: '2025-01-03', status: 'completed' },
      { amount: 500, selling_price: 700, description: 'Service delivery', customer_name: 'Customer 2', payment_method: 'Bank Transfer', date: '2025-01-05', status: 'completed' },
      { amount: 800, selling_price: 1200, description: 'Product sale', customer_name: 'Customer 3', payment_method: 'Credit Card', date: '2025-01-08', status: 'completed' }
    ];
    
    for (const sale of salesData) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO sales (user_id, amount, selling_price, description, customer_name, payment_method, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, sale.amount, sale.selling_price, sale.description, sale.customer_name, sale.payment_method, sale.date, sale.status],
          function(err) {
            if (err) reject(err);
            else {
              // Add transaction record
              db.run(
                'INSERT INTO transactions (user_id, transaction_type, reference_id, reference_table, amount, description, date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, 'sale', this.lastID, 'sales', sale.selling_price, sale.description, sale.date],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            }
          }
        );
      });
    }
    
    // Insert account data
    const accountData = [
      { account_type: 'cash', account_name: 'Cash', balance: 5000 },
      { account_type: 'bank', account_name: 'Checking Account', balance: 15000, bank_name: 'Main Bank', account_number: '****1234' },
      { account_type: 'savings', account_name: 'Savings Account', balance: 25000, bank_name: 'Main Bank', account_number: '****5678' }
    ];
    
    for (const account of accountData) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO accounts (user_id, account_type, account_name, balance, bank_name, account_number) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, account.account_type, account.account_name, account.balance, account.bank_name || null, account.account_number || null],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    // Insert loan data
    const loanData = [
      { loan_type: 'business', lender_name: 'Business Bank', principal_amount: 50000, current_balance: 35000, interest_rate: 5.5, monthly_payment: 1200, start_date: '2024-06-01', due_date: '2027-06-01', status: 'active' }
    ];
    
    for (const loan of loanData) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO loans (user_id, loan_type, lender_name, principal_amount, current_balance, interest_rate, monthly_payment, start_date, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, loan.loan_type, loan.lender_name, loan.principal_amount, loan.current_balance, loan.interest_rate, loan.monthly_payment, loan.start_date, loan.due_date, loan.status],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    // Insert charity data
    const charityData = [
      { amount_required: 200, amount_paid: 200, status: 'paid', payment_date: '2025-01-10', description: 'Charity for income', recipient: 'Local Charity' },
      { amount_required: 150, amount_paid: 75, status: 'partial', description: 'Charity for income', recipient: 'Local Charity' },
      { amount_required: 100, amount_paid: 0, status: 'pending', description: 'Charity for income', recipient: 'Local Charity' }
    ];
    
    for (const charity of charityData) {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO charity (user_id, amount_required, amount_paid, status, payment_date, description, recipient) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [userId, charity.amount_required, charity.amount_paid, charity.status, charity.payment_date || null, charity.description, charity.recipient],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    console.log('✅ Sample data seeded successfully!');
    console.log('Demo account credentials:');
    console.log('Username: demo');
    console.log('Password: demo123');
    
    db.close();
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    db.close();
  }
};

seedData();