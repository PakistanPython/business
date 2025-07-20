import express from 'express';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const { employee_id } = req.query;

    let query = `
      SELECT 
        ws.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_work_schedules ws
      JOIN employees e ON ws.employee_id = e.id
      WHERE e.business_id = $1
    `;
    const params: any[] = [businessId];

    if (employee_id) {
      query += ' AND ws.employee_id = $2';
      params.push(employee_id as string);
    }

    query += ' ORDER BY ws.effective_from DESC';

    const schedules = await dbAll(query, params);
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching work schedules:', error);
    res.status(500).json({ error: 'Failed to fetch work schedules' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const {
      employee_id,
      schedule_name,
      effective_from,
      effective_to,
      monday_start,
      monday_end,
      tuesday_start,
      tuesday_end,
      wednesday_start,
      wednesday_end,
      thursday_start,
      thursday_end,
      friday_start,
      friday_end,
      saturday_start,
      saturday_end,
      sunday_start,
      sunday_end,
      break_duration,
      weekly_hours,
      is_active
    } = req.body;

    if (!employee_id || !schedule_name || !effective_from) {
      return res.status(400).json({ 
        error: 'Employee ID, schedule name and effective from are required' 
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
      INSERT INTO employee_work_schedules (
        employee_id, business_id, schedule_name, effective_from, effective_to,
        monday_start, monday_end, tuesday_start, tuesday_end,
        wednesday_start, wednesday_end, thursday_start, thursday_end,
        friday_start, friday_end, saturday_start, saturday_end,
        sunday_start, sunday_end, break_duration, weekly_hours, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING id
    `, [
      employee_id, businessId, schedule_name, effective_from, effective_to,
      monday_start, monday_end, tuesday_start, tuesday_end,
      wednesday_start, wednesday_end, thursday_start, thursday_end,
      friday_start, friday_end, saturday_start, saturday_end,
      sunday_start, sunday_end, break_duration, weekly_hours, is_active
    ]);

    const newSchedule = await dbGet(`
      SELECT 
        ws.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_work_schedules ws
      JOIN employees e ON ws.employee_id = e.id
      WHERE ws.id = $1
    `, [result.lastID]);

    res.status(201).json(newSchedule);
  } catch (error) {
    console.error('Error creating work schedule:', error);
    res.status(500).json({ error: 'Failed to create work schedule' });
  }
});

export default router;
