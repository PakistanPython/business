import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all categories
router.get('/', [
  query('type').optional().isIn(['income', 'expense', 'purchase', 'sale']).withMessage('Type must be income, expense, purchase, or sale')
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
    const type = req.query.type as string;

    let whereClause = 'WHERE business_id = $1';
    const whereParams: any[] = [userId];
    let paramIndex = 2;

    if (type) {
      whereClause += ` AND type = $${paramIndex++}`;
      whereParams.push(type);
    }

    console.log('Category API - whereClause:', whereClause);
    console.log('Category API - whereParams:', whereParams);

    const categories = await dbAll(
      `SELECT id, name, type, created_at 
       FROM categories 
       ${whereClause} 
       ORDER BY type, name`,
      whereParams
    );

    console.log('Category API - Fetched categories:', categories);

    // Group categories by type
    const groupedCategories = categories.reduce((acc: any, category: any) => {
      if (!acc[category.type]) {
        acc[category.type] = [];
      }
      acc[category.type].push(category);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        categories: categories,
        grouped: groupedCategories
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get category by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const categoryId = parseInt(req.params.id);

    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID'
      });
    }

    const category = await dbGet(
      'SELECT id, name, type, created_at FROM categories WHERE id = $1 AND business_id = $2',
      [categoryId, userId]
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    res.json({
      success: true,
      data: { category }
    });
  } catch (error) {
    console.error('Get category by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new category
router.post('/', [
  body('name')
    .trim()
    .notEmpty()
    .isLength({ max: 50 })
    .withMessage('Category name is required and cannot exceed 50 characters'),
  body('type')
    .isIn(['income', 'expense', 'purchase', 'sale'])
    .withMessage('Type must be income, expense, purchase, or sale'),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color code'),
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Icon cannot exceed 50 characters')
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
    const { name, type, color = '#3B82F6', icon = 'circle' } = req.body;

    // Check for duplicate category name and type for the user
    const existingCategory = await dbGet(
      'SELECT id FROM categories WHERE business_id = $1 AND name = $2 AND type = $3',
      [userId, name, type]
    );

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message: 'Category with this name and type already exists'
      });
    }

    // Insert category record
    const result = await dbRun(
      'INSERT INTO categories (business_id, name, type, color, icon) VALUES ($1, $2, $3, $4, $5)',
      [userId, name, type, color, icon]
    );

    const categoryId = result.lastID;

    // Get the created category record
    const newCategory = await dbGet(
      'SELECT * FROM categories WHERE id = $1',
      [categoryId]
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category: newCategory }
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update category
router.put('/:id', [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .isLength({ max: 50 })
    .withMessage('Category name cannot be empty and cannot exceed 50 characters'),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color code'),
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Icon cannot exceed 50 characters')
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
    const categoryId = parseInt(req.params.id);

    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID'
      });
    }

    // Check if category exists and belongs to user
    const existingCategory = await dbGet(
      'SELECT id, name, type FROM categories WHERE id = $1 AND business_id = $2',
      [categoryId, userId]
    );

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    const { name, color, icon } = req.body;

    // Check for duplicate category name if changing name
    if (name && name !== existingCategory.name) {
      const duplicateCategory = await dbGet(
        'SELECT id FROM categories WHERE business_id = $1 AND name = $2 AND type = $3 AND id != $4',
        [userId, name, existingCategory.type, categoryId]
      );

      if (duplicateCategory) {
        return res.status(409).json({
          success: false,
          message: 'Category with this name and type already exists'
        });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 2;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      values.push(color);
    }
    if (icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(icon);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.unshift(categoryId);

    // Update category record
    await dbRun(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = $1`,
      values
    );

    // Get updated record
    const updatedCategory = await dbGet(
      'SELECT * FROM categories WHERE id = $1',
      [categoryId]
    );

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: { category: updatedCategory }
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete category
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const categoryId = parseInt(req.params.id);

    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID'
      });
    }

    // Check if category exists and belongs to user
    const category = await dbGet(
      'SELECT id, name, type FROM categories WHERE id = $1 AND business_id = $2',
      [categoryId, userId]
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category is being used in income or expenses
    const incomeUsage = await dbGet(
      'SELECT COUNT(*) as count FROM income WHERE business_id = $1 AND category_id = $2',
      [userId, category.id]
    );

    const expenseUsage = await dbGet(
      'SELECT COUNT(*) as count FROM expenses WHERE business_id = $1 AND category_id = $2',
      [userId, category.id]
    );

    const purchaseUsage = await dbGet(
      'SELECT COUNT(*) as count FROM purchases WHERE business_id = $1 AND category_id = $2',
      [userId, category.id]
    );

    if (incomeUsage.count > 0 || expenseUsage.count > 0 || purchaseUsage.count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category that is being used in transactions',
        data: {
          income_count: incomeUsage.count,
          expense_count: expenseUsage.count,
          purchase_count: purchaseUsage.count
        }
      });
    }

    // Delete category record
    await dbRun(
      'DELETE FROM categories WHERE id = $1 AND business_id = $2',
      [categoryId, userId]
    );

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get category usage statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const categoryId = parseInt(req.params.id);

    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID'
      });
    }

    // Get category info
    const category = await dbGet(
      'SELECT id, name, type FROM categories WHERE id = $1 AND business_id = $2',
      [categoryId, userId]
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get usage statistics based on category type
    let usageStats;
    if (category.type === 'income') {
      usageStats = await dbGet(
        `SELECT 
          COUNT(*) as transaction_count,
          SUM(amount) as total_amount,
          AVG(amount) as average_amount,
          MIN(amount) as min_amount,
          MAX(amount) as max_amount,
          MIN(date) as earliest_date,
          MAX(date) as latest_date
         FROM income 
         WHERE business_id = $1 AND category_id = $2`,
        [userId, category.id]
      );
    } else {
      usageStats = await dbGet(
        `SELECT 
          COUNT(*) as transaction_count,
          SUM(amount) as total_amount,
          AVG(amount) as average_amount,
          MIN(amount) as min_amount,
          MAX(amount) as max_amount,
          MIN(date) as earliest_date,
          MAX(date) as latest_date
         FROM expenses 
         WHERE business_id = $1 AND category_id = $2`,
        [userId, category.id]
      );
    }

    // Get monthly breakdown for current year
    const table = category.type === 'income' ? 'income' : 'expenses';
    const monthlyStats = await dbAll(
      `SELECT 
        to_char(date, 'MM') as month,
        SUM(amount) as monthly_amount,
        COUNT(*) as monthly_count
       FROM ${table} 
       WHERE business_id = $1 AND category_id = $2 AND to_char(date, 'YYYY') = to_char(CURRENT_DATE, 'YYYY')
       GROUP BY to_char(date, 'MM')
       ORDER BY to_char(date, 'MM')`,
      [userId, category.id]
    );

    res.json({
      success: true,
      data: {
        category,
        usage_stats: usageStats,
        monthly_breakdown: monthlyStats
      }
    });
  } catch (error) {
    console.error('Category stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all categories with usage counts
router.get('/usage/summary', async (req, res) => {
  try {
    const userId = req.user!.userId;

    // Get categories with usage counts
    const categoriesWithUsage = await dbAll(
      `SELECT 
        c.id,
        c.name,
        c.type,
        c.color,
        c.icon,
        c.created_at,
        COALESCE(usage.transaction_count, 0) as transaction_count,
        COALESCE(usage.total_amount, 0) as total_amount
       FROM categories c
       LEFT JOIN (
         SELECT 
           c.name as category,
           'income' as type,
           CAST(COUNT(*) AS INTEGER) as transaction_count,
           SUM(amount) as total_amount
         FROM income i
         JOIN categories c ON i.category_id = c.id
         WHERE i.business_id = $1
         GROUP BY c.name
         
         UNION ALL
         
         SELECT 
           c.name as category,
           'expense' as type,
           CAST(COUNT(*) AS INTEGER) as transaction_count,
           SUM(e.amount) as total_amount
         FROM expenses e
         JOIN categories c ON e.category_id = c.id
         WHERE e.business_id = $1
         GROUP BY c.name

         UNION ALL

         SELECT
           c.name as category,
           'purchase' as type,
           CAST(COUNT(*) AS INTEGER) as transaction_count,
           SUM(p.amount) as total_amount
         FROM purchases p
         JOIN categories c ON p.category_id = c.id
         WHERE p.business_id = $1
         GROUP BY c.name
       ) usage ON c.name = usage.category AND c.type = usage.type
       WHERE c.business_id = $2
       ORDER BY c.type, usage.total_amount DESC, c.name`,
      [userId, userId]
    );

    res.json({
      success: true,
      data: { categories: categoriesWithUsage }
    });
  } catch (error) {
    console.error('Category usage summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
