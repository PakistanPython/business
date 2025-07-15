import express from 'express';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { validateSale } from '../middleware/validation';

const router = express.Router();

// Get all sales for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    
    const rows = await dbAll(`
      SELECT 
        s.*, 
        p.description as purchase_description,
        p.category as purchase_category,
        p.date as purchase_date
      FROM sales s
      LEFT JOIN purchases p ON s.purchase_id = p.id
      WHERE s.user_id = ? ORDER BY s.date DESC, s.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: {
        sales: rows,
        total: rows.length
      }
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales'
    });
  }
});

// Get sales summary for dashboard
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    const summary = await dbGet(`
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(selling_price), 0) as total_revenue,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(AVG(profit_percentage), 0) as avg_profit_percentage,
        COALESCE(SUM(CASE WHEN date >= date('now', '-30 days') THEN selling_price ELSE 0 END), 0) as monthly_revenue,
        COALESCE(SUM(CASE WHEN date >= date('now', '-30 days') THEN profit ELSE 0 END), 0) as monthly_profit
      FROM sales 
      WHERE user_id = ? AND status = 'completed'
    `, [userId]);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching sales summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales summary'
    });
  }
});

// Get single sale by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const saleId = req.params.id;

    const sale = await dbGet(`
      SELECT 
        s.*, 
        p.description as purchase_description,
        p.category as purchase_category,
        p.date as purchase_date
      FROM sales s
      LEFT JOIN purchases p ON s.purchase_id = p.id
      WHERE s.id = ? AND s.user_id = ? `, [saleId, userId]);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.json({
      success: true,
      data: sale
    });
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sale'
    });
  }
});

// Create new sale
router.post('/', authenticateToken, validateSale, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const {
      purchase_id,
      amount,
      selling_price,
      description,
      customer_name,
      customer_contact,
      payment_method,
      date,
      status = 'completed',
      notes
    } = req.body;

    const result = await dbRun(`
      INSERT INTO sales 
      (user_id, purchase_id, amount, selling_price, description, customer_name, customer_contact, payment_method, date, status, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [userId, purchase_id || null, amount, selling_price, description, customer_name, customer_contact, payment_method, date, status, notes]);

    const saleId = result.rows?.[0]?.id;

    // Create transaction record
    await dbRun(`
      INSERT INTO transactions 
      (user_id, transaction_type, reference_id, reference_table, amount, description, date)
      VALUES ($12, 'sale', ?, 'sales', ?, ?, ?)
    `, [userId, saleId, selling_price, description || 'Sale transaction', date]);

    // Get the created sale with purchase details
    const sale = await dbGet(`
      SELECT 
        s.*, 
        p.description as purchase_description,
        p.category as purchase_category,
        p.date as purchase_date
      FROM sales s
      LEFT JOIN purchases p ON s.purchase_id = p.id
      WHERE s.id = ? `, [saleId]);

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: sale
    });
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create sale'
    });
  }
});

// Update sale
router.put('/:id', authenticateToken, validateSale, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const saleId = req.params.id;
    const {
      purchase_id,
      amount,
      selling_price,
      description,
      customer_name,
      customer_contact,
      payment_method,
      date,
      status,
      notes
    } = req.body;

    // Check if sale exists and belongs to user
    const existing = await dbGet(
      'SELECT id FROM sales WHERE id = ? AND user_id = $2',
      [saleId, userId]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    await dbRun(`
      UPDATE sales 
      SET purchase_id = $1, amount = $2, selling_price = $3, description = $4, 
          customer_name = $5, customer_contact = $6, payment_method = $7, 
          date = $8, status = $9, notes = $10, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? `, [purchase_id || null, amount, selling_price, description, customer_name, customer_contact, payment_method, date, status, notes, saleId, userId]);

    // Update transaction record
    await dbRun(`
      UPDATE transactions 
      SET amount = $13, description = $14, date = ? WHERE reference_id = ? AND reference_table = 'sales' AND user_id = ?
    `, [selling_price, description || 'Sale transaction', date, saleId, userId]);

    // Get updated sale with purchase details
    const sale = await dbGet(`
      SELECT 
        s.*, 
        p.description as purchase_description,
        p.category as purchase_category,
        p.date as purchase_date
      FROM sales s
      LEFT JOIN purchases p ON s.purchase_id = p.id
      WHERE s.id = ? `, [saleId]);

    res.json({
      success: true,
      message: 'Sale updated successfully',
      data: sale
    });
  } catch (error) {
    console.error('Error updating sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sale'
    });
  }
});

// Delete sale
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const saleId = req.params.id;

    // Check if sale exists and belongs to user
    const existing = await dbGet(
      'SELECT id FROM sales WHERE id = ? AND user_id = $2',
      [saleId, userId]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Delete transaction record first
    await dbRun(`
      DELETE FROM transactions 
      WHERE reference_id = ? AND reference_table = 'sales' AND user_id = ?
    `, [saleId, userId]);

    // Delete sale
    await dbRun(
      'DELETE FROM sales WHERE id = ? AND user_id = $2',
      [saleId, userId]
    );

    res.json({
      success: true,
      message: 'Sale deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete sale'
    });
  }
});

// Get available purchases for sale (purchases not yet sold)
router.get('/available/purchases', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    
    const rows = await dbAll(`
      SELECT p.*
      FROM purchases p
      LEFT JOIN sales s ON p.id = s.purchase_id
      WHERE p.user_id = ? AND s.purchase_id IS NULL
      ORDER BY p.date DESC, p.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: {
        purchases: rows,
        total: rows.length
      }
    });
  } catch (error) {
    console.error('Error fetching available purchases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available purchases'
    });
  }
});

export default router;
