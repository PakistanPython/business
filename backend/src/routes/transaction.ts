import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { dbAll } from '../config/database';
import json2csv from 'json2csv';

const router = express.Router();

// Download all transactions
router.get('/download', authenticateToken, async (req, res) => {
  try {
    const businessId = req.user!.businessId;

    const transactions = await dbAll(`
      SELECT 'income' as type, date, description, amount FROM income WHERE business_id = $1
      UNION ALL
      SELECT 'expense' as type, date, description, amount FROM expenses WHERE business_id = $1
      UNION ALL
      SELECT 'purchase' as type, date, description, amount FROM purchases WHERE business_id = $1
      UNION ALL
      SELECT 'sale' as type, date, description, selling_price as amount FROM sales WHERE business_id = $1
    `, [businessId]);

    const csv = json2csv.parse(transactions);

    res.header('Content-Type', 'text/csv');
    res.attachment(`transactions-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);

  } catch (error) {
    console.error('Transaction backup failed:', error);
    res.status(500).json({ success: false, message: 'Transaction backup failed' });
  }
});

export default router;
