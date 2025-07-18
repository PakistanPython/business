import { up as createUsersTable } from './migrations/000_create_users_table';
import { up as createEmployeesTable } from './migrations/001_create_employees_table';
import { up as createAccountsTable } from './migrations/002_create_accounts_table';
import { up as createAccountsPayableTable } from './migrations/003_create_accounts_payable_table';
import { up as createAccountsReceivableTable } from './migrations/004_create_accounts_receivable_table';
import { up as createAttendanceRulesTable } from './migrations/005_create_attendance_rules_table';
import { up as createAttendanceTable } from './migrations/006_create_attendance_table';
import { up as createCategoriesTable } from './migrations/007_create_categories_table';
import { up as createCharityTable } from './migrations/008_create_charity_table';
import { up as createExpensesTable } from './migrations/009_create_expenses_table';
import { up as createIncomeTable } from './migrations/010_create_income_table';
import { up as createLeavesTable } from './migrations/011_create_leaves_table';
import { up as createLoansTable } from './migrations/012_create_loans_table';
import { up as createPayrollTable } from './migrations/013_create_payroll_table';
import { up as createPurchasesTable } from './migrations/014_create_purchases_table';
import { up as createSalesTable } from './migrations/015_create_sales_table';
import { up as createWorkSchedulesTable } from './migrations/016_create_work_schedules_table';
import { up as addCharityPercentageToIncome } from './migrations/017_add_charity_percentage_to_income';
import { up as addSourceToIncome } from './migrations/018_add_source_to_income';
import { pool, testConnection } from './config/database';
import dotenv from 'dotenv';

dotenv.config();

const runMigrations = async () => {
  try {
    await testConnection();
    console.log('Running migrations...');
    await createUsersTable();
    await createEmployeesTable();
    await createAccountsTable();
    await createAccountsPayableTable();
    await createAccountsReceivableTable();
    await createAttendanceRulesTable();
    await createAttendanceTable();
    await createCategoriesTable();
    await createCharityTable();
    await createExpensesTable();
    await createIncomeTable();
    await createLeavesTable();
    await createLoansTable();
    await createPayrollTable();
    await createPurchasesTable();
    await createSalesTable();
    await createWorkSchedulesTable();
    await addCharityPercentageToIncome();
    await addSourceToIncome();
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    pool.end();
  }
};

runMigrations();
