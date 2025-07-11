"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbRun = exports.dbAll = exports.dbGet = exports.initializeDatabase = exports.testConnection = exports.db = void 0;
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
const initializeDatabase = async () => {
    try {
        await createTables();
        console.log('✅ Database tables initialized successfully');
    }
    catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
};
exports.initializeDatabase = initializeDatabase;
const createTables = async () => {
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      business_name TEXT,
      user_type TEXT CHECK(user_type IN ('admin', 'manager', 'hr', 'employee', 'accountant')) DEFAULT 'admin',
      business_id INTEGER,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
        `CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'General',
      source TEXT,
      date DATE NOT NULL,
      charity_required REAL GENERATED ALWAYS AS (amount * 0.025) STORED,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      payment_method TEXT DEFAULT 'Cash',
      date DATE NOT NULL,
      receipt_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      payment_method TEXT DEFAULT 'Cash',
      date DATE NOT NULL,
      receipt_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      purchase_id INTEGER,
      amount REAL NOT NULL,
      selling_price REAL NOT NULL,
      profit REAL GENERATED ALWAYS AS (selling_price - amount) STORED,
      profit_percentage REAL GENERATED ALWAYS AS (CASE WHEN amount > 0 THEN ((selling_price - amount) / amount * 100) ELSE 0 END) STORED,
      description TEXT,
      customer_name TEXT,
      customer_contact TEXT,
      payment_method TEXT DEFAULT 'Cash',
      date DATE NOT NULL,
      status TEXT CHECK(status IN ('pending', 'completed', 'cancelled')) DEFAULT 'completed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL
    )`,
        `CREATE TABLE IF NOT EXISTS charity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      income_id INTEGER,
      amount_required REAL NOT NULL,
      amount_paid REAL DEFAULT 0.00,
      amount_remaining REAL GENERATED ALWAYS AS (amount_required - amount_paid) STORED,
      status TEXT CHECK(status IN ('pending', 'partial', 'paid')) DEFAULT 'pending',
      payment_date DATE,
      description TEXT,
      recipient TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (income_id) REFERENCES income(id) ON DELETE SET NULL
    )`,
        `CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_type TEXT CHECK(account_type IN ('cash', 'bank', 'savings', 'investment')) NOT NULL,
      account_name TEXT NOT NULL,
      balance REAL DEFAULT 0.00,
      bank_name TEXT,
      account_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      loan_type TEXT CHECK(loan_type IN ('personal', 'business', 'mortgage', 'auto', 'other')) NOT NULL,
      lender_name TEXT NOT NULL,
      principal_amount REAL NOT NULL,
      current_balance REAL NOT NULL,
      interest_rate REAL,
      monthly_payment REAL,
      start_date DATE NOT NULL,
      due_date DATE,
      status TEXT CHECK(status IN ('active', 'paid', 'defaulted')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      transaction_type TEXT CHECK(transaction_type IN ('income', 'expense', 'purchase', 'sale', 'transfer', 'loan_payment', 'charity')) NOT NULL,
      reference_id INTEGER,
      reference_table TEXT,
      amount REAL NOT NULL,
      description TEXT,
      account_id INTEGER,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
    )`,
        `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('income', 'expense', 'purchase', 'sale')) NOT NULL,
      color TEXT DEFAULT '#3B82F6',
      icon TEXT DEFAULT 'circle',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name, type)
    )`,
        `CREATE TABLE IF NOT EXISTS accounts_receivable (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      invoice_number TEXT NOT NULL,
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0.00,
      balance_amount REAL GENERATED ALWAYS AS (amount - paid_amount) STORED,
      status TEXT CHECK(status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled')) DEFAULT 'pending',
      payment_terms TEXT,
      description TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(business_id, invoice_number)
    )`,
        `CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
        `CREATE TABLE IF NOT EXISTS payment_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      record_type TEXT CHECK(record_type IN ('receivable', 'payable', 'loan')) NOT NULL,
      record_id INTEGER NOT NULL,
      payment_date DATE NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'Cash',
      reference_number TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS employee_work_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      schedule_name TEXT NOT NULL,
      effective_from DATE NOT NULL,
      effective_to DATE,
      monday_start TIME,
      monday_end TIME,
      tuesday_start TIME,
      tuesday_end TIME,
      wednesday_start TIME,
      wednesday_end TIME,
      thursday_start TIME,
      thursday_end TIME,
      friday_start TIME,
      friday_end TIME,
      saturday_start TIME,
      saturday_end TIME,
      sunday_start TIME,
      sunday_end TIME,
      break_duration INTEGER DEFAULT 60, -- in minutes
      weekly_hours REAL DEFAULT 40,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS leave_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      max_days_per_year INTEGER DEFAULT 0,
      max_days_per_month INTEGER DEFAULT 0,
      carry_forward BOOLEAN DEFAULT 0,
      is_paid BOOLEAN DEFAULT 1,
      requires_approval BOOLEAN DEFAULT 1,
      advance_notice_days INTEGER DEFAULT 1,
      color TEXT DEFAULT '#3B82F6',
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(business_id, name)
    )`,
        `CREATE TABLE IF NOT EXISTS employee_leave_entitlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      leave_type_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      total_days REAL NOT NULL,
      used_days REAL DEFAULT 0,
      remaining_days REAL GENERATED ALWAYS AS (total_days - used_days) STORED,
      carried_forward REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(employee_id, leave_type_id, year)
    )`,
        `CREATE TABLE IF NOT EXISTS employee_leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      leave_type_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      total_days REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',
      approved_by INTEGER,
      approved_at DATETIME,
      rejection_reason TEXT,
      emergency_contact TEXT,
      handover_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
        `CREATE TABLE IF NOT EXISTS attendance_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      rule_name TEXT NOT NULL,
      late_grace_period INTEGER DEFAULT 15, -- minutes
      late_penalty_type TEXT CHECK(late_penalty_type IN ('none', 'deduction', 'half_day', 'warning')) DEFAULT 'none',
      late_penalty_amount REAL DEFAULT 0,
      half_day_threshold INTEGER DEFAULT 240, -- minutes (4 hours)
      overtime_threshold INTEGER DEFAULT 480, -- minutes (8 hours)
      overtime_rate REAL DEFAULT 1.5,
      min_working_hours REAL DEFAULT 8,
      max_working_hours REAL DEFAULT 12,
      auto_clock_out BOOLEAN DEFAULT 0,
      auto_clock_out_time TIME DEFAULT '18:00',
      weekend_overtime BOOLEAN DEFAULT 1,
      holiday_overtime BOOLEAN DEFAULT 1,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
        `CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      date DATE NOT NULL,
      clock_in_time TIME,
      clock_out_time TIME,
      break_start_time TIME,
      break_end_time TIME,
      total_hours REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      late_minutes INTEGER DEFAULT 0,
      early_departure_minutes INTEGER DEFAULT 0,
      attendance_type TEXT CHECK(attendance_type IN ('regular', 'overtime', 'holiday', 'weekend')) DEFAULT 'regular',
      entry_method TEXT CHECK(entry_method IN ('manual', 'biometric', 'rfid', 'mobile')) DEFAULT 'manual',
      status TEXT CHECK(status IN ('present', 'absent', 'late', 'half_day', 'on_leave', 'holiday')) DEFAULT 'present',
      location_latitude REAL,
      location_longitude REAL,
      notes TEXT,
      approved_by INTEGER,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(employee_id, date)
    )`,
        `CREATE TABLE IF NOT EXISTS payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      pay_period_start DATE NOT NULL,
      pay_period_end DATE NOT NULL,
      basic_salary REAL NOT NULL,
      overtime_amount REAL DEFAULT 0,
      bonus REAL DEFAULT 0,
      allowances REAL DEFAULT 0,
      gross_salary REAL GENERATED ALWAYS AS (basic_salary + overtime_amount + bonus + allowances) STORED,
      tax_deduction REAL DEFAULT 0,
      insurance_deduction REAL DEFAULT 0,
      loan_deduction REAL DEFAULT 0,
      leave_deduction REAL DEFAULT 0,
      other_deductions REAL DEFAULT 0,
      total_deductions REAL GENERATED ALWAYS AS (tax_deduction + insurance_deduction + loan_deduction + leave_deduction + other_deductions) STORED,
      net_salary REAL GENERATED ALWAYS AS (basic_salary + overtime_amount + bonus + allowances - tax_deduction - insurance_deduction - loan_deduction - leave_deduction - other_deductions) STORED,
      total_working_days INTEGER DEFAULT 0,
      total_present_days INTEGER DEFAULT 0,
      total_absent_days INTEGER DEFAULT 0,
      total_leave_days INTEGER DEFAULT 0,
      total_overtime_hours REAL DEFAULT 0,
      status TEXT CHECK(status IN ('draft', 'approved', 'paid')) DEFAULT 'draft',
      payment_method TEXT CHECK(payment_method IN ('cash', 'bank_transfer', 'cheque', 'online')) DEFAULT 'bank_transfer',
      payment_date DATE,
      payment_reference TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(employee_id, pay_period_start, pay_period_end)
    )`,
        `CREATE TABLE IF NOT EXISTS employee_attendance_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      business_id INTEGER NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      total_working_days INTEGER DEFAULT 0,
      total_present_days INTEGER DEFAULT 0,
      total_absent_days INTEGER DEFAULT 0,
      total_late_days INTEGER DEFAULT 0,
      total_half_days INTEGER DEFAULT 0,
      total_overtime_hours REAL DEFAULT 0,
      total_working_hours REAL DEFAULT 0,
      avg_check_in_time TIME,
      avg_check_out_time TIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(employee_id, month, year)
    )`
    ];
    for (const table of tables) {
        await new Promise((resolve, reject) => {
            exports.db.run(table, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_income_user_date ON income(user_id, date)',
        'CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date)',
        'CREATE INDEX IF NOT EXISTS idx_purchases_user_date ON purchases(user_id, date)',
        'CREATE INDEX IF NOT EXISTS idx_charity_user_status ON charity(user_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date)',
        'CREATE INDEX IF NOT EXISTS idx_accounts_user_type ON accounts(user_id, account_type)',
        'CREATE INDEX IF NOT EXISTS idx_accounts_receivable_business_status ON accounts_receivable(business_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_accounts_receivable_due_date ON accounts_receivable(due_date)',
        'CREATE INDEX IF NOT EXISTS idx_payment_records_record ON payment_records(record_type, record_id)',
        'CREATE INDEX IF NOT EXISTS idx_employees_business_status ON employees(business_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date)',
        'CREATE INDEX IF NOT EXISTS idx_attendance_business_date ON attendance(business_id, date)',
        'CREATE INDEX IF NOT EXISTS idx_payroll_employee_period ON payroll(employee_id, pay_period_start, pay_period_end)',
        'CREATE INDEX IF NOT EXISTS idx_payroll_business_status ON payroll(business_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_work_schedules_employee ON employee_work_schedules(employee_id, is_active)',
        'CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status ON employee_leave_requests(employee_id, status)',
        'CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON employee_leave_requests(start_date, end_date)',
        'CREATE INDEX IF NOT EXISTS idx_leave_entitlements_employee_year ON employee_leave_entitlements(employee_id, year)',
        'CREATE INDEX IF NOT EXISTS idx_attendance_summary_employee_period ON employee_attendance_summary(employee_id, year, month)'
    ];
    for (const index of indexes) {
        await new Promise((resolve, reject) => {
            exports.db.run(index, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
};
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
