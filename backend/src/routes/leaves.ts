import express from 'express';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';

const router = express.Router();

router.use(authenticateToken);

// Create leave_types table and seed data
(async () => {
  try {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS leave_types (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        max_days_per_year INTEGER,
        is_paid BOOLEAN DEFAULT true,
        business_id INTEGER,
        FOREIGN KEY (business_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    const leaveTypes = await dbAll('SELECT * FROM leave_types');
    if (leaveTypes.length === 0) {
      await dbRun(`
        INSERT INTO leave_types (name, description, max_days_per_year, is_paid) VALUES
        ('Annual Leave', 'Annual paid leave', 20, true),
        ('Sick Leave', 'Leave for sickness', 10, true),
        ('Unpaid Leave', 'Unpaid leave', 30, false)
      `);
    }
  } catch (error) {
    console.error('Error initializing leave types:', error);
  }
})();

router.get('/types', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const leaveTypes = await dbAll('SELECT * FROM leave_types WHERE business_id = $1 OR business_id IS NULL', [businessId]);
    res.json(leaveTypes);
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({ error: 'Failed to fetch leave types' });
  }
});

router.post('/types', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const { name, description, max_days_per_year, is_paid } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Leave type name is required' });
    }

    const result = await dbRun(
      'INSERT INTO leave_types (name, description, max_days_per_year, is_paid, business_id) VALUES ($1, $2, $3, $4, $5)',
      [name, description, max_days_per_year, is_paid, businessId]
    );

    const newLeaveType = await dbGet('SELECT * FROM leave_types WHERE id = $1', [result.lastID]);
    res.status(201).json(newLeaveType);
  } catch (error) {
    console.error('Error creating leave type:', error);
    res.status(500).json({ error: 'Failed to create leave type' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const { employee_id } = req.query;

    let query = `
      SELECT 
        l.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM leaves l
      JOIN employees e ON l.employee_id = e.id
      WHERE e.business_id = $1
    `;
    const params: any[] = [businessId];

    if (employee_id) {
      query += ' AND l.employee_id = $2';
      params.push(employee_id as string);
    }

    query += ' ORDER BY l.start_date DESC';

    const leaves = await dbAll(query, params);
    res.json(leaves);
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({ error: 'Failed to fetch leaves' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const {
      employee_id,
      start_date,
      end_date,
      leave_type,
      status
    } = req.body;

    if (!employee_id || !start_date || !end_date || !leave_type) {
      return res.status(400).json({ 
        error: 'Employee ID, start date, end date and leave type are required' 
      });
    }

    const employee = await dbGet(
      'SELECT id FROM employees WHERE id = $1 AND business_id = $2',
      [employee_id, businessId]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const result = await dbRun(`
      INSERT INTO leaves (
        employee_id, start_date, end_date, leave_type, status
      ) VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [
      employee_id, start_date, end_date, leave_type, status || 'pending'
    ]);

    const newLeave = await dbGet(`
      SELECT 
        l.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM leaves l
      JOIN employees e ON l.employee_id = e.id
      WHERE l.id = $1
    `, [result.lastID]);

    res.status(201).json(newLeave);
  } catch (error) {
    console.error('Error creating leave:', error);
    res.status(500).json({ error: 'Failed to create leave' });
  }
});

export default router;
