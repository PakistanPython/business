import express from 'express';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/work-schedules - Get work schedules
router.get('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const { employee_id, is_active } = req.query;

    let query = `
      SELECT 
        ws.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_work_schedules ws
      JOIN employees e ON ws.employee_id = e.id
      WHERE ws.business_id = ? `;
    const params: any[] = [businessId];

    if (employee_id) {
      query += ' AND ws.employee_id = ?';
      params.push(employee_id as string);
    }

    if (is_active !== undefined) {
      query += ' AND ws.is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }

    query += ' ORDER BY ws.effective_from DESC';

    const schedules = await dbAll(query, params);
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching work schedules:', error);
    res.status(500).json({ error: 'Failed to fetch work schedules' });
  }
});

// GET /api/work-schedules/:id - Get single work schedule
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user!.userId;

    const schedule = await dbGet(`
      SELECT 
        ws.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_work_schedules ws
      JOIN employees e ON ws.employee_id = e.id
      WHERE ws.id = ? AND ws.business_id = ? `, [id, businessId]);

    if (!schedule) {
      return res.status(404).json({ error: 'Work schedule not found' });
    }

    res.json(schedule);
  } catch (error) {
    console.error('Error fetching work schedule:', error);
    res.status(500).json({ error: 'Failed to fetch work schedule' });
  }
});

// POST /api/work-schedules - Create new work schedule
router.post('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user?.userId;
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
      weekly_hours
    } = req.body;

    // Validate required fields
    if (!employee_id || !schedule_name || !effective_from) {
      return res.status(400).json({ 
        error: 'Employee ID, schedule name, and effective from date are required' 
      });
    }

    // Check if employee belongs to this business
    const employee = await dbGet(
      'SELECT id FROM employees WHERE id = ? AND business_id = $2',
      [employee_id, businessId]
    );

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Deactivate previous active schedules if this is the new active one
    if (req.body.is_active) {
      await dbRun(
        'UPDATE employee_work_schedules SET is_active = 0 WHERE employee_id = ? AND business_id = $2',
        [employee_id, businessId]
      );
    }

    // Create work schedule
    const result = await dbRun(`
      INSERT INTO employee_work_schedules (
        employee_id, business_id, schedule_name, effective_from, effective_to,
        monday_start, monday_end, tuesday_start, tuesday_end,
        wednesday_start, wednesday_end, thursday_start, thursday_end,
        friday_start, friday_end, saturday_start, saturday_end,
        sunday_start, sunday_end, break_duration, weekly_hours, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      employee_id, businessId, schedule_name, effective_from, effective_to,
      monday_start, monday_end, tuesday_start, tuesday_end,
      wednesday_start, wednesday_end, thursday_start, thursday_end,
      friday_start, friday_end, saturday_start, saturday_end,
      sunday_start, sunday_end, break_duration || 60, weekly_hours || 40,
      req.body.is_active ? 1 : 0
    ]);

    // Fetch the created schedule
    const newSchedule = await dbGet(`
      SELECT 
        ws.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_work_schedules ws
      JOIN employees e ON ws.employee_id = e.id
      WHERE ws.id = ?
    `, [result.rows?.[0]?.id]);

    res.status(201).json(newSchedule);
  } catch (error) {
    console.error('Error creating work schedule:', error);
    res.status(500).json({ error: 'Failed to create work schedule' });
  }
});

// PUT /api/work-schedules/:id - Update work schedule
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.userId;
    
    const {
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

    // Check if schedule exists and belongs to this business
    const existingSchedule = await dbGet(
      'SELECT * FROM employee_work_schedules WHERE id = ? AND business_id = $2',
      [id, businessId]
    );

    if (!existingSchedule) {
      return res.status(404).json({ error: 'Work schedule not found' });
    }

    // If setting this as active, deactivate others for this employee
    if (is_active) {
      await dbRun(
        'UPDATE employee_work_schedules SET is_active = 0 WHERE employee_id = ? AND business_id = ? AND id != $3',
        [existingSchedule.employee_id, businessId, id]
      );
    }

    // Update work schedule
    await dbRun(`
      UPDATE employee_work_schedules SET
        schedule_name = ?, effective_from = ?, effective_to = ?,
        monday_start = ?, monday_end = ?, tuesday_start = ?, tuesday_end = ?,
        wednesday_start = ?, wednesday_end = ?, thursday_start = ?, thursday_end = ?,
        friday_start = ?, friday_end = ?, saturday_start = ?, saturday_end = ?,
        sunday_start = ?, sunday_end = ?, break_duration = ?, weekly_hours = ?,
        is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `, [
      schedule_name || existingSchedule.schedule_name,
      effective_from || existingSchedule.effective_from,
      effective_to || existingSchedule.effective_to,
      monday_start || existingSchedule.monday_start,
      monday_end || existingSchedule.monday_end,
      tuesday_start || existingSchedule.tuesday_start,
      tuesday_end || existingSchedule.tuesday_end,
      wednesday_start || existingSchedule.wednesday_start,
      wednesday_end || existingSchedule.wednesday_end,
      thursday_start || existingSchedule.thursday_start,
      thursday_end || existingSchedule.thursday_end,
      friday_start || existingSchedule.friday_start,
      friday_end || existingSchedule.friday_end,
      saturday_start || existingSchedule.saturday_start,
      saturday_end || existingSchedule.saturday_end,
      sunday_start || existingSchedule.sunday_start,
      sunday_end || existingSchedule.sunday_end,
      break_duration || existingSchedule.break_duration,
      weekly_hours || existingSchedule.weekly_hours,
      is_active !== undefined ? (is_active ? 1 : 0) : existingSchedule.is_active,
      id,
      businessId
    ]);

    // Fetch updated schedule
    const updatedSchedule = await dbGet(`
      SELECT 
        ws.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_work_schedules ws
      JOIN employees e ON ws.employee_id = e.id
      WHERE ws.id = ?
    `, [id]);

    res.json(updatedSchedule);
  } catch (error) {
    console.error('Error updating work schedule:', error);
    res.status(500).json({ error: 'Failed to update work schedule' });
  }
});

// DELETE /api/work-schedules/:id - Delete work schedule
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.userId;

    // Check if schedule exists and belongs to this business
    const schedule = await dbGet(
      'SELECT id FROM employee_work_schedules WHERE id = ? AND business_id = $2',
      [id, businessId]
    );

    if (!schedule) {
      return res.status(404).json({ error: 'Work schedule not found' });
    }

    // Delete work schedule
    await dbRun('DELETE FROM employee_work_schedules WHERE id = ? AND business_id = $2', [id, businessId]);

    res.json({ message: 'Work schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting work schedule:', error);
    res.status(500).json({ error: 'Failed to delete work schedule' });
  }
});

// GET /api/work-schedules/employee/:employeeId/current - Get current active schedule for employee
router.get('/employee/:employeeId/current', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const businessId = req.user?.userId;

    const currentDate = new Date().toISOString().split('T')[0];

    const schedule = await dbGet(`
      SELECT 
        ws.*,
        e.first_name,
        e.last_name,
        e.employee_code
      FROM employee_work_schedules ws
      JOIN employees e ON ws.employee_id = e.id
      WHERE ws.employee_id = ? AND ws.business_id = ? AND ws.is_active = 1
        AND ws.effective_from <= ? AND (ws.effective_to IS NULL OR ws.effective_to >= $4)
      ORDER BY ws.effective_from DESC
      LIMIT 1
    `, [employeeId, businessId, currentDate, currentDate]);

    res.json(schedule || null);
  } catch (error) {
    console.error('Error fetching current work schedule:', error);
    res.status(500).json({ error: 'Failed to fetch current work schedule' });
  }
});

export default router;