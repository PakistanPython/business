import express from 'express';
import { query, validationResult } from 'express-validator';
import { dbGet, dbAll } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get dashboard summary
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user!.userId;

    // Get financial summary
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
      total_ar_outstanding: 0,
      total_ar_overdue: 0,
      ar_invoices_count: 0,
      ar_overdue_count: 0,
      net_worth: 0,
      available_cash: 0
    };

    // Get totals
    const incomeTotal = await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE business_id = $1', [userId]);
    const expenseTotal = await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_id = $1', [userId]);
    const purchaseTotal = await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM purchases WHERE business_id = $1', [userId]);
    const salesTotal = await dbGet('SELECT COALESCE(SUM(selling_price), 0) as revenue, COALESCE(SUM(selling_price - amount), 0) as profit FROM sales WHERE business_id = $1', [userId]);
    const purchaseCount = await dbGet('SELECT COUNT(*) as count FROM purchases WHERE business_id = $1', [userId]);
    const salesCount = await dbGet('SELECT COUNT(*) as count FROM sales WHERE business_id = $1', [userId]);
    const accountsBalance = await dbGet('SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE business_id = $1', [userId]);
    const activeLoans = await dbGet('SELECT COALESCE(SUM(current_balance), 0) as total FROM loans WHERE business_id = $1 AND status = \'active\'', [userId]);
    const charityRequired = await dbGet('SELECT COALESCE(SUM(amount_required), 0) as total FROM charity WHERE business_id = $1', [userId]);
    const charityPaid = await dbGet('SELECT COALESCE(SUM(amount_paid), 0) as total FROM charity WHERE business_id = $1', [userId]);
    const charityRemaining = await dbGet('SELECT COALESCE(SUM(amount_required - amount_paid), 0) as total FROM charity WHERE business_id = $1', [userId]);
    const arOutstanding = await dbGet('SELECT COALESCE(SUM(amount - paid_amount), 0) as total, COUNT(*) as count FROM accounts_receivable WHERE business_id = $1 AND status != \'paid\'', [userId]);
    const arOverdue = await dbGet('SELECT COALESCE(SUM(amount - paid_amount), 0) as total, COUNT(*) as count FROM accounts_receivable WHERE business_id = $1 AND received = FALSE AND due_date < CURRENT_DATE', [userId]);

    summary.total_income = parseFloat(incomeTotal.total || 0);
    summary.total_expenses = parseFloat(expenseTotal.total || 0);
    summary.total_purchases = parseFloat(purchaseTotal.total || 0);
    summary.total_sales_revenue = parseFloat(salesTotal.revenue || 0);
    summary.total_sales_profit = parseFloat(salesTotal.profit || 0);
    summary.total_purchases_count = parseInt(purchaseCount.count || 0);
    summary.total_sales_count = parseInt(salesCount.count || 0);
    summary.total_accounts_balance = parseFloat(accountsBalance.total || 0);
    summary.total_active_loans = parseFloat(activeLoans.total || 0);
    summary.total_charity_required = parseFloat(charityRequired.total || 0);
    summary.total_charity_paid = parseFloat(charityPaid.total || 0);
    summary.total_charity_remaining = parseFloat(charityRemaining.total || 0);
    summary.total_ar_outstanding = parseFloat(arOutstanding.total || 0);
    summary.total_ar_overdue = parseFloat(arOverdue.total || 0);
    summary.ar_invoices_count = parseInt(arOutstanding.count || 0);
    summary.ar_overdue_count = parseInt(arOverdue.count || 0);
    summary.net_worth = summary.total_income - summary.total_expenses;
    summary.available_cash = summary.total_accounts_balance - summary.total_active_loans;

    // Get monthly data for current year
    const monthlyData = await dbAll(`
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
        SELECT to_char(date, 'MM') as month, SUM(amount) as monthly_income
        FROM income
        WHERE business_id = $1 AND to_char(date, 'YYYY') = to_char(CURRENT_DATE, 'YYYY')
        GROUP BY to_char(date, 'MM')
      ) i ON to_char(m.month_num, 'FM00') = i.month
      LEFT JOIN (
        SELECT to_char(date, 'MM') as month, SUM(amount) as monthly_expenses
        FROM expenses
        WHERE business_id = $2 AND to_char(date, 'YYYY') = to_char(CURRENT_DATE, 'YYYY')
        GROUP BY to_char(date, 'MM')
      ) e ON to_char(m.month_num, 'FM00') = e.month
      LEFT JOIN (
        SELECT to_char(created_at, 'MM') as month, SUM(amount_required) as monthly_charity
        FROM charity
        WHERE business_id = $3 AND to_char(created_at, 'YYYY') = to_char(CURRENT_DATE, 'YYYY')
        GROUP BY to_char(created_at, 'MM')
      ) c ON to_char(m.month_num, 'FM00') = c.month
      ORDER BY m.month_num
    `, [userId, userId, userId]);

    // Get recent transactions
    const recentTransactions = await dbAll(`
      SELECT id, amount, description, date, created_at, 'income' as transaction_type
      FROM income
      WHERE business_id = $1
      UNION ALL
      SELECT id, amount, description, date, created_at, 'expense' as transaction_type
      FROM expenses
      WHERE business_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId]);

    // Get top expense categories
    const topExpenseCategories = await dbAll(`
      SELECT 
        c.name as category,
        SUM(e.amount) as total_amount,
        COUNT(*) as transaction_count,
        ROUND(CAST((SUM(e.amount) / (SELECT SUM(amount) FROM expenses WHERE business_id = $1)) * 100 AS numeric), 2) as percentage
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      WHERE e.business_id = $2 
      GROUP BY c.name 
      ORDER BY total_amount DESC 
      LIMIT 5
    `, [userId, userId]);

    // Get income vs expenses trend (last 6 months)
    const trendData = await dbAll(`
      WITH RECURSIVE months(month_date) AS (
        SELECT DATE_TRUNC('month', NOW() - INTERVAL '5 months')
        UNION ALL
        SELECT month_date + INTERVAL '1 month'
        FROM months
        WHERE month_date < DATE_TRUNC('month', NOW())
      )
      SELECT 
        to_char(m.month_date, 'YYYY-MM') as month,
        to_char(m.month_date, 'Mon YYYY') as month_label,
        COALESCE(i.income_amount, 0) as income,
        COALESCE(e.expense_amount, 0) as expenses
      FROM months m
      LEFT JOIN (
        SELECT to_char(date, 'YYYY-MM') as month, SUM(amount) as income_amount
        FROM income 
        WHERE business_id = $1
        GROUP BY to_char(date, 'YYYY-MM')
      ) i ON to_char(m.month_date, 'YYYY-MM') = i.month
      LEFT JOIN (
        SELECT to_char(date, 'YYYY-MM') as month, SUM(amount) as expense_amount
        FROM expenses 
        WHERE business_id = $2
        GROUP BY to_char(date, 'YYYY-MM')
      ) e ON to_char(m.month_date, 'YYYY-MM') = e.month
      ORDER BY m.month_date
    `, [userId, userId]);

    // Get charity status overview
    const charityOverview = await dbAll(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(amount_required) as total_required,
        SUM(amount_paid) as total_paid,
        SUM(amount_required - amount_paid) as total_remaining
      FROM charity 
      WHERE business_id = $1 
      GROUP BY status
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
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get detailed analytics
router.get('/analytics', [
  query('period').optional().isIn(['week', 'month', 'quarter', 'year']).withMessage('Invalid period'),
  query('year').optional().isInt({ min: 2000, max: 2100 }).withMessage('Invalid year'),
  query('time_range').optional().isIn(['3months', '6months', '12months', '24months', 'current_year']).withMessage('Invalid time range')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user!.userId;
    const period = req.query.period as string || 'month';
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const timeRange = req.query.time_range as string;

    let dateFilter = '';
    let groupBy = '';

    if (timeRange) {
      let intervalMonths = 0;
      switch (timeRange) {
        case '3months': intervalMonths = 3; break;
        case '6months': intervalMonths = 6; break;
        case '12months': intervalMonths = 12; break;
        case '24months': intervalMonths = 24; break;
        case 'current_year':
          dateFilter = `AND to_char(date, 'YYYY') = to_char(CURRENT_DATE, 'YYYY')`;
          groupBy = `to_char(date, 'YYYY-MM')`;
          break;
      }
      if (intervalMonths > 0) {
        dateFilter = `AND date >= NOW() - INTERVAL '${intervalMonths} months'`;
        groupBy = `to_char(date, 'YYYY-MM')`;
      }
    } else {
      switch (period) {
        case 'week':
          dateFilter = `AND to_char(date, 'YYYY') = '${year}' AND to_char(date, 'WW') >= to_char(NOW() - INTERVAL '12 weeks', 'WW')`;
          groupBy = `to_char(date, 'YYYY-WW')`;
          break;
        case 'quarter':
          dateFilter = `AND to_char(date, 'YYYY') = '${year}'`;
          groupBy = `to_char(date, 'YYYY-Q')`;
          break;
        case 'year':
          dateFilter = `AND to_char(date, 'YYYY') >= '${year - 4}'`;
          groupBy = `to_char(date, 'YYYY')`;
          break;
        default: // month
          dateFilter = `AND date >= NOW() - INTERVAL '12 months'`;
          groupBy = `to_char(date, 'YYYY-MM')`;
      }
    }

    // Get income analytics
    const incomeAnalytics = await dbAll(`
      SELECT 
        ${groupBy} as period,
        SUM(i.amount) as total_amount,
        COUNT(*) as transaction_count,
        AVG(i.amount) as average_amount,
        c.name as category
      FROM income i
      JOIN categories c ON i.category_id = c.id
      WHERE i.business_id = $1 ${dateFilter}
      GROUP BY period, c.name
      ORDER BY period, total_amount DESC
    `, [userId]);

    // Get expense analytics
    const expenseAnalytics = await dbAll(`
      SELECT 
        ${groupBy} as period,
        SUM(e.amount) as total_amount,
        COUNT(*) as transaction_count,
        AVG(e.amount) as average_amount,
        c.name as category
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      WHERE e.business_id = $1 ${dateFilter}
      GROUP BY period, c.name
      ORDER BY period, total_amount DESC
    `, [userId]);

    // Get purchase analytics
    const purchaseAnalytics = await dbAll(`
      SELECT 
        ${groupBy} as period,
        SUM(p.amount) as total_amount,
        COUNT(*) as transaction_count,
        AVG(p.amount) as average_amount,
        c.name as category
      FROM purchases p
      JOIN categories c ON p.category_id = c.id
      WHERE p.business_id = $1 ${dateFilter}
      GROUP BY period, c.name
      ORDER BY period, total_amount DESC
    `, [userId]);

    // Get profitability analysis
    const profitAnalysis = await dbAll(`
      SELECT 
        period,
        SUM(income) as income,
        SUM(expenses) as expenses,
        (SUM(income) - SUM(expenses)) as profit,
        CASE 
          WHEN SUM(income) > 0 
          THEN ROUND(CAST(((SUM(income) - SUM(expenses)) / SUM(income)) * 100 AS numeric), 2)
          ELSE 0 
        END as profit_margin
      FROM (
        SELECT ${groupBy} as period, SUM(amount) as income, 0 as expenses
        FROM income
        WHERE business_id = $1 ${dateFilter}
        GROUP BY period

        UNION ALL

        SELECT ${groupBy} as period, 0 as income, SUM(amount) as expenses
        FROM expenses
        WHERE business_id = $2 ${dateFilter}
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
        purchase_analytics: purchaseAnalytics,
        profit_analysis: profitAnalysis
      }
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get performance metrics
router.get('/metrics', async (req, res) => {
  try {
    const userId = req.user!.userId;

    // Get key performance indicators
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

    // Get revenue metrics
    const revenue30d = await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE business_id = $1 AND date >= NOW() - INTERVAL \'30 days\'', [userId]);
    const revenue90d = await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE business_id = $1 AND date >= NOW() - INTERVAL \'90 days\'', [userId]);
    
    // Get expense metrics
    const expenses30d = await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_id = $1 AND date >= NOW() - INTERVAL \'30 days\'', [userId]);
    const expenses90d = await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE business_id = $1 AND date >= NOW() - INTERVAL \'90 days\'', [userId]);
    
    // Get average metrics
    const avgIncome30d = await dbGet('SELECT COALESCE(AVG(amount), 0) as avg FROM income WHERE business_id = $1 AND date >= NOW() - INTERVAL \'30 days\'', [userId]);
    const avgExpense30d = await dbGet('SELECT COALESCE(AVG(amount), 0) as avg FROM expenses WHERE business_id = $1 AND date >= NOW() - INTERVAL \'30 days\'', [userId]);
    
    // Get charity metrics
    const charityPaid30d = await dbGet('SELECT COALESCE(SUM(amount_paid), 0) as total FROM charity WHERE business_id = $1 AND updated_at >= NOW() - INTERVAL \'30 days\' AND status = \'paid\'', [userId]);
    const charityPending = await dbGet('SELECT COALESCE(SUM(amount_required - amount_paid), 0) as total FROM charity WHERE business_id = $1 AND status != \'paid\'', [userId]);
    
    // Get account metrics
    const totalAccounts = await dbGet('SELECT COUNT(*) as count FROM accounts WHERE business_id = $1', [userId]);
    const activeLoans = await dbGet('SELECT COUNT(*) as count FROM loans WHERE employee_id IN (SELECT id FROM employees WHERE business_id = $1) AND status = \'active\'', [userId]);

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

    // Calculate derived metrics
    metrics.profit_30d = metrics.revenue_30d - metrics.expenses_30d;
    metrics.profit_90d = metrics.revenue_90d - metrics.expenses_90d;
    metrics.burn_rate = metrics.expenses_30d / 30; // Daily burn rate
    metrics.charity_compliance = metrics.charity_pending === 0 ? 100 : 
      ((metrics.charity_paid_30d / (metrics.charity_paid_30d + metrics.charity_pending)) * 100);

    // Get trend comparisons (current month vs previous month)
    const currentMonth = await dbGet(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
      FROM (
        SELECT 'income' as type, amount FROM income 
        WHERE business_id = $1 AND to_char(date, 'YYYY-MM') = to_char(NOW(), 'YYYY-MM')
        UNION ALL
        SELECT 'expense' as type, amount FROM expenses 
        WHERE business_id = $2 AND to_char(date, 'YYYY-MM') = to_char(NOW(), 'YYYY-MM')
      )
    `, [userId, userId]);

    const previousMonth = await dbGet(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
      FROM (
        SELECT 'income' as type, amount FROM income 
        WHERE business_id = $1 AND to_char(date, 'YYYY-MM') = to_char(NOW() - INTERVAL '1 month', 'YYYY-MM')
        UNION ALL
        SELECT 'expense' as type, amount FROM expenses 
        WHERE business_id = $2 AND to_char(date, 'YYYY-MM') = to_char(NOW() - INTERVAL '1 month', 'YYYY-MM')
      )
    `, [userId, userId]);

    // Calculate growth rates
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
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
