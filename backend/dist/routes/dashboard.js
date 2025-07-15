"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
router.get('/summary', async (req, res) => {
    try {
        const userId = req.user.userId;
        const summary = {
            total_income: 0,
            total_expenses: 0,
            total_purchases: 0,
            total_sales_revenue: 0,
            total_sales_profit: 0,
            total_purchases_count: 0,
            total_sales_count: 0,
            total_accounts_balance: 0,
            total_active_loans: 0,
            total_charity_required: 0,
            total_charity_paid: 0,
            total_charity_remaining: 0,
            net_worth: 0,
            available_cash: 0
        };
        const incomeTotal = await (0, database_1.dbGet)('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE user_id = $1', [userId]);
        const expenseTotal = await (0, database_1.dbGet)('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = $1', [userId]);
        const purchaseTotal = await (0, database_1.dbGet)('SELECT COALESCE(SUM(amount), 0) as total FROM purchases WHERE user_id = $1', [userId]);
        const salesTotal = await (0, database_1.dbGet)('SELECT COALESCE(SUM(selling_price), 0) as revenue, COALESCE(SUM(profit), 0) as profit FROM sales WHERE user_id = ? AND status = "completed"', [userId]);
        const purchaseCount = await (0, database_1.dbGet)('SELECT COUNT(*) as count FROM purchases WHERE user_id = $1', [userId]);
        const salesCount = await (0, database_1.dbGet)('SELECT COUNT(*) as count FROM sales WHERE user_id = ? AND status = "completed"', [userId]);
        const accountsBalance = await (0, database_1.dbGet)('SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE user_id = $1', [userId]);
        const activeLoans = await (0, database_1.dbGet)('SELECT COALESCE(SUM(current_balance), 0) as total FROM loans WHERE user_id = ? AND status = "active"', [userId]);
        const charityRequired = await (0, database_1.dbGet)('SELECT COALESCE(SUM(amount_required), 0) as total FROM charity WHERE user_id = $1', [userId]);
        const charityPaid = await (0, database_1.dbGet)('SELECT COALESCE(SUM(amount_paid), 0) as total FROM charity WHERE user_id = $1', [userId]);
        const charityRemaining = await (0, database_1.dbGet)('SELECT COALESCE(SUM(amount_remaining), 0) as total FROM charity WHERE user_id = $1', [userId]);
        summary.total_income = parseFloat(incomeTotal?.total || 0);
        summary.total_expenses = parseFloat(expenseTotal?.total || 0);
        summary.total_purchases = parseFloat(purchaseTotal?.total || 0);
        summary.total_sales_revenue = parseFloat(salesTotal?.revenue || 0);
        summary.total_sales_profit = parseFloat(salesTotal?.profit || 0);
        summary.total_purchases_count = parseInt(purchaseCount?.count || 0);
        summary.total_sales_count = parseInt(salesCount?.count || 0);
        summary.total_accounts_balance = parseFloat(accountsBalance?.total || 0);
        summary.total_active_loans = parseFloat(activeLoans?.total || 0);
        summary.total_charity_required = parseFloat(charityRequired?.total || 0);
        summary.total_charity_paid = parseFloat(charityPaid?.total || 0);
        summary.total_charity_remaining = parseFloat(charityRemaining?.total || 0);
        summary.net_worth = summary.total_income - summary.total_expenses;
        summary.available_cash = summary.total_accounts_balance - summary.total_active_loans;
        const monthlyData = await (0, database_1.dbAll)(`
      WITH months AS (
        SELECT 1 as month_num, 'Jan' as month_name
        UNION SELECT 2, 'Feb' UNION SELECT 3, 'Mar' UNION SELECT 4, 'Apr'
        UNION SELECT 5, 'May' UNION SELECT 6, 'Jun' UNION SELECT 7, 'Jul'
        UNION SELECT 8, 'Aug' UNION SELECT 9, 'Sep' UNION SELECT 10, 'Oct'
        UNION SELECT 11, 'Nov' UNION SELECT 12, 'Dec'
      )
      SELECT 
        m.month_num,
        m.month_name,
        COALESCE(i.monthly_income, 0) as monthly_income,
        COALESCE(e.monthly_expenses, 0) as monthly_expenses,
        COALESCE(c.monthly_charity, 0) as monthly_charity,
        (COALESCE(i.monthly_income, 0) - COALESCE(e.monthly_expenses, 0)) as monthly_profit
      FROM months m
      LEFT JOIN (
        SELECT strftime('%m', date) as month, SUM(amount) as monthly_income
        FROM income 
        WHERE user_id = ? AND strftime('%Y', date) = strftime('%Y', 'now')
        GROUP BY strftime('%m', date)
      ) i ON printf('%02d', m.month_num) = i.month
      LEFT JOIN (
        SELECT strftime('%m', date) as month, SUM(amount) as monthly_expenses
        FROM expenses 
        WHERE user_id = ? AND strftime('%Y', date) = strftime('%Y', 'now')
        GROUP BY strftime('%m', date)
      ) e ON printf('%02d', m.month_num) = e.month
      LEFT JOIN (
        SELECT strftime('%m', payment_date) as month, SUM(amount_paid) as monthly_charity
        FROM charity 
        WHERE user_id = ? AND payment_date IS NOT NULL AND strftime('%Y', payment_date) = strftime('%Y', 'now')
        GROUP BY strftime('%m', payment_date)
      ) c ON printf('%02d', m.month_num) = c.month
      ORDER BY m.month_num
    `, [userId, userId, userId]);
        const recentTransactions = await (0, database_1.dbAll)(`
      SELECT 
        id, transaction_type, amount, description, date, created_at,
        reference_table, reference_id
      FROM transactions 
      WHERE user_id = ? ORDER BY created_at DESC 
      LIMIT 10
    `, [userId]);
        const topExpenseCategories = await (0, database_1.dbAll)(`
      SELECT 
        category,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        ROUND((SUM(amount) / (SELECT SUM(amount) FROM expenses WHERE user_id = $2)) * 100, 2) as percentage
      FROM expenses 
      WHERE user_id = ? GROUP BY category 
      ORDER BY total_amount DESC 
      LIMIT 5
    `, [userId, userId]);
        const trendData = await (0, database_1.dbAll)(`
      WITH RECURSIVE months(month_date) AS (
        SELECT date('now', 'start of month', '-5 months')
        UNION ALL
        SELECT date(month_date, '+1 month')
        FROM months
        WHERE month_date < date('now', 'start of month')
      )
      SELECT 
        strftime('%Y-%m', m.month_date) as month,
        strftime('%b %Y', m.month_date) as month_label,
        COALESCE(i.income_amount, 0) as income,
        COALESCE(e.expense_amount, 0) as expenses
      FROM months m
      LEFT JOIN (
        SELECT strftime('%Y-%m', date) as month, SUM(amount) as income_amount
        FROM income 
        WHERE user_id = ? 
        GROUP BY strftime('%Y-%m', date)
      ) i ON strftime('%Y-%m', m.month_date) = i.month
      LEFT JOIN (
        SELECT strftime('%Y-%m', date) as month, SUM(amount) as expense_amount
        FROM expenses 
        WHERE user_id = ? 
        GROUP BY strftime('%Y-%m', date)
      ) e ON strftime('%Y-%m', m.month_date) = e.month
      ORDER BY m.month_date
    `, [userId, userId]);
        const charityOverview = await (0, database_1.dbAll)(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(amount_required) as total_required,
        SUM(amount_paid) as total_paid,
        SUM(amount_remaining) as total_remaining
      FROM charity 
      WHERE user_id = ? GROUP BY status
    `, [userId]);
        res.json({
            success: true,
            data: {
                summary,
                monthly_data: monthlyData,
                recent_transactions: recentTransactions,
                top_expense_categories: topExpenseCategories,
                trend_data: trendData,
                charity_overview: charityOverview
            }
        });
    }
    catch (error) {
        console.error('Dashboard summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/analytics', [
    (0, express_validator_1.query)('period').optional().isIn(['week', 'month', 'quarter', 'year']).withMessage('Invalid period'),
    (0, express_validator_1.query)('year').optional().isInt({ min: 2000, max: 2100 }).withMessage('Invalid year'),
    (0, express_validator_1.query)('time_range').optional().isIn(['3months', '6months', '12months', '24months']).withMessage('Invalid time range')
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        const userId = req.user.userId;
        const period = req.query.period || 'month';
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const timeRange = req.query.time_range;
        let dateFilter = '';
        let groupBy = '';
        if (timeRange) {
            let intervalMonths = 0;
            switch (timeRange) {
                case '3months':
                    intervalMonths = 3;
                    break;
                case '6months':
                    intervalMonths = 6;
                    break;
                case '12months':
                    intervalMonths = 12;
                    break;
                case '24months':
                    intervalMonths = 24;
                    break;
            }
            dateFilter = `AND date >= date('now', '-${intervalMonths} months')`;
            groupBy = `strftime('%Y-%m', date)`;
        }
        else {
            switch (period) {
                case 'week':
                    dateFilter = `AND strftime('%Y', date) = '${year}' AND strftime('%W', date) >= strftime('%W', date('now', '-12 weeks'))`;
                    groupBy = `strftime('%Y-W%W', date)`;
                    break;
                case 'quarter':
                    dateFilter = `AND strftime('%Y', date) = '${year}'`;
                    groupBy = `strftime('%Y-Q', date) || ((cast(strftime('%m', date) as integer) - 1) / 3 + 1)`;
                    break;
                case 'year':
                    dateFilter = `AND strftime('%Y', date) >= '${year - 4}'`;
                    groupBy = `strftime('%Y', date)`;
                    break;
                default:
                    dateFilter = `AND date >= date('now', '-12 months')`;
                    groupBy = `strftime('%Y-%m', date)`;
            }
        }
        const incomeAnalytics = await (0, database_1.dbAll)(`
      SELECT 
        ${groupBy} as period,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        AVG(amount) as average_amount,
        category,
        SUM(charity_required) as charity_generated
      FROM income 
      WHERE user_id = ? ${dateFilter}
      GROUP BY period, category
      ORDER BY period, total_amount DESC
    `, [userId]);
        const expenseAnalytics = await (0, database_1.dbAll)(`
      SELECT 
        ${groupBy} as period,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        AVG(amount) as average_amount,
        category
      FROM expenses 
      WHERE user_id = ? ${dateFilter}
      GROUP BY period, category
      ORDER BY period, total_amount DESC
    `, [userId]);
        const profitAnalysis = await (0, database_1.dbAll)(`
      SELECT 
        period,
        SUM(income) as income,
        SUM(expenses) as expenses,
        (SUM(income) - SUM(expenses)) as profit,
        CASE 
          WHEN SUM(income) > 0 
          THEN ROUND(((SUM(income) - SUM(expenses)) / SUM(income)) * 100, 2)
          ELSE 0 
        END as profit_margin
      FROM (
        SELECT ${groupBy} as period, SUM(amount) as income, 0 as expenses
        FROM income 
        WHERE user_id = ? ${dateFilter}
        GROUP BY period
        
        UNION ALL
        
        SELECT ${groupBy} as period, 0 as income, SUM(amount) as expenses
        FROM expenses 
        WHERE user_id = ? ${dateFilter}
        GROUP BY period
      )
      GROUP BY period
      ORDER BY period
    `, [userId, userId]);
        res.json({
            success: true,
            data: {
                period,
                year,
                income_analytics: incomeAnalytics,
                expense_analytics: expenseAnalytics,
                profit_analysis: profitAnalysis
            }
        });
    }
    catch (error) {
        console.error('Dashboard analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/metrics', async (req, res) => {
    try {
        const userId = req.user.userId;
        const metrics = {
            revenue_30d: 0,
            revenue_90d: 0,
            expenses_30d: 0,
            expenses_90d: 0,
            avg_income_30d: 0,
            avg_expense_30d: 0,
            charity_paid_30d: 0,
            charity_pending: 0,
            total_accounts: 0,
            active_loans: 0,
            profit_30d: 0,
            profit_90d: 0,
            burn_rate: 0,
            charity_compliance: 0
        };
        const revenue30d = await (0, database_1.dbGet)('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE user_id = ? AND date >= date("now", "-30 days")', [userId]);
        const revenue90d = await (0, database_1.dbGet)('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE user_id = ? AND date >= date("now", "-90 days")', [userId]);
        const expenses30d = await (0, database_1.dbGet)('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND date >= date("now", "-30 days")', [userId]);
        const expenses90d = await (0, database_1.dbGet)('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND date >= date("now", "-90 days")', [userId]);
        const avgIncome30d = await (0, database_1.dbGet)('SELECT COALESCE(AVG(amount), 0) as avg FROM income WHERE user_id = ? AND date >= date("now", "-30 days")', [userId]);
        const avgExpense30d = await (0, database_1.dbGet)('SELECT COALESCE(AVG(amount), 0) as avg FROM expenses WHERE user_id = ? AND date >= date("now", "-30 days")', [userId]);
        const charityPaid30d = await (0, database_1.dbGet)('SELECT COALESCE(SUM(amount_paid), 0) as total FROM charity WHERE user_id = ? AND payment_date >= date("now", "-30 days")', [userId]);
        const charityPending = await (0, database_1.dbGet)('SELECT COALESCE(SUM(amount_remaining), 0) as total FROM charity WHERE user_id = ? AND status != "paid"', [userId]);
        const totalAccounts = await (0, database_1.dbGet)('SELECT COUNT(*) as count FROM accounts WHERE user_id = $1', [userId]);
        const activeLoans = await (0, database_1.dbGet)('SELECT COUNT(*) as count FROM loans WHERE user_id = ? AND status = "active"', [userId]);
        metrics.revenue_30d = parseFloat(revenue30d?.total || 0);
        metrics.revenue_90d = parseFloat(revenue90d?.total || 0);
        metrics.expenses_30d = parseFloat(expenses30d?.total || 0);
        metrics.expenses_90d = parseFloat(expenses90d?.total || 0);
        metrics.avg_income_30d = parseFloat(avgIncome30d?.avg || 0);
        metrics.avg_expense_30d = parseFloat(avgExpense30d?.avg || 0);
        metrics.charity_paid_30d = parseFloat(charityPaid30d?.total || 0);
        metrics.charity_pending = parseFloat(charityPending?.total || 0);
        metrics.total_accounts = parseInt(totalAccounts?.count || 0);
        metrics.active_loans = parseInt(activeLoans?.count || 0);
        metrics.profit_30d = metrics.revenue_30d - metrics.expenses_30d;
        metrics.profit_90d = metrics.revenue_90d - metrics.expenses_90d;
        metrics.burn_rate = metrics.expenses_30d / 30;
        metrics.charity_compliance = metrics.charity_pending === 0 ? 100 :
            ((metrics.charity_paid_30d / (metrics.charity_paid_30d + metrics.charity_pending)) * 100);
        const currentMonth = await (0, database_1.dbGet)(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
      FROM (
        SELECT 'income' as type, amount FROM income 
        WHERE user_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
        UNION ALL
        SELECT 'expense' as type, amount FROM expenses 
        WHERE user_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
      )
    `, [userId, userId]);
        const previousMonth = await (0, database_1.dbGet)(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
      FROM (
        SELECT 'income' as type, amount FROM income 
        WHERE user_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', date('now', '-1 month'))
        UNION ALL
        SELECT 'expense' as type, amount FROM expenses 
        WHERE user_id = ? AND strftime('%Y-%m', date) = strftime('%Y-%m', date('now', '-1 month'))
      )
    `, [userId, userId]);
        const incomeGrowthRate = (previousMonth?.income || 0) > 0 ?
            (((currentMonth?.income || 0) - (previousMonth?.income || 0)) / (previousMonth?.income || 0)) * 100 : 0;
        const expenseGrowthRate = (previousMonth?.expenses || 0) > 0 ?
            (((currentMonth?.expenses || 0) - (previousMonth?.expenses || 0)) / (previousMonth?.expenses || 0)) * 100 : 0;
        res.json({
            success: true,
            data: {
                kpi_metrics: metrics,
                growth_rates: {
                    income_growth: Math.round(incomeGrowthRate * 100) / 100,
                    expense_growth: Math.round(expenseGrowthRate * 100) / 100
                },
                trend_comparison: {
                    current_month: currentMonth,
                    previous_month: previousMonth
                }
            }
        });
    }
    catch (error) {
        console.error('Dashboard metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
exports.default = router;
