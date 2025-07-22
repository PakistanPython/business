import express from 'express';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Get all sales for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    
    const rows = await dbAll(`
      SELECT 
        s.*,
        (s.selling_price - s.amount) as profit,
        CASE WHEN s.amount > 0 THEN ((s.selling_price - s.amount) / s.amount) * 100 ELSE 0 END as profit_percentage,
        p.description as purchase_description
      FROM sales s
      LEFT JOIN purchases p ON s.purchase_id = p.id
      WHERE s.business_id = $1
      ORDER BY s.date DESC, s.created_at DESC
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
    const userId = req.user!.userId;
    
    const summary = await dbGet(`
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(amount), 0) as total_revenue
      FROM sales 
      WHERE business_id = $1
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
        s.*
      FROM sales s
      WHERE s.id = $1 AND s.business_id = $2
    `, [saleId, userId]);

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
router.post('/', authenticateToken, [
    body('purchase_id').notEmpty().isInt(),
    body('amount').isFloat({ gt: 0 }),
    body('selling_price').isFloat({ gt: 0 }),
    body('description').optional().isString(),
    body('customer_name').optional().isString(),
    body('customer_contact').optional().isString(),
    body('payment_method').isString(),
    body('date').isISO8601().toDate(),
    body('status').isString(),
    body('notes').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
      status,
      notes,
    } = req.body;

    const result = await dbRun(`
      INSERT INTO sales 
      (business_id, purchase_id, amount, selling_price, description, customer_name, customer_contact, payment_method, date, status, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
    `, [userId, purchase_id, amount, selling_price, description, customer_name, customer_contact, payment_method, date, status, notes]);

    const saleId = result.lastID;

    const sale = await dbGet(`
      SELECT 
        s.*
      FROM sales s
      WHERE s.id = $1
    `, [saleId]);

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
router.put('/:id', authenticateToken, [
    body('purchase_id').optional().isInt(),
    body('amount').optional().isFloat({ gt: 0 }),
    body('selling_price').optional().isFloat({ gt: 0 }),
    body('description').optional().isString(),
    body('customer_name').optional().isString(),
    body('customer_contact').optional().isString(),
    body('payment_method').optional().isString(),
    body('date').optional().isISO8601().toDate(),
    body('status').optional().isString(),
    body('notes').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
      notes,
    } = req.body;

    const existing = await dbGet(
      'SELECT id FROM sales WHERE id = $1 AND business_id = $2',
      [saleId, userId]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (purchase_id) {
        updates.push(`purchase_id = $${paramIndex++}`);
        values.push(purchase_id);
    }
    if (amount) {
        updates.push(`amount = $${paramIndex++}`);
        values.push(amount);
    }
    if (selling_price) {
        updates.push(`selling_price = $${paramIndex++}`);
        values.push(selling_price);
    }
    if (description) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
    }
    if (customer_name) {
        updates.push(`customer_name = $${paramIndex++}`);
        values.push(customer_name);
    }
    if (customer_contact) {
        updates.push(`customer_contact = $${paramIndex++}`);
        values.push(customer_contact);
    }
    if (payment_method) {
        updates.push(`payment_method = $${paramIndex++}`);
        values.push(payment_method);
    }
    if (date) {
        updates.push(`date = $${paramIndex++}`);
        values.push(date);
    }
    if (status) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
    }
    if (notes) {
        updates.push(`notes = $${paramIndex++}`);
        values.push(notes);
    }

    if (updates.length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(saleId, userId);

    await dbRun(`
      UPDATE sales 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND business_id = $${paramIndex++}
    `, values);

    const sale = await dbGet(`
      SELECT 
        s.*
      FROM sales s
      WHERE s.id = $1
    `, [saleId]);

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

    const existing = await dbGet(
      'SELECT id FROM sales WHERE id = $1 AND business_id = $2',
      [saleId, userId]
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    await dbRun(
      'DELETE FROM sales WHERE id = $1 AND business_id = $2',
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
      WHERE p.business_id = $1
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
