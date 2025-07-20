import express from 'express';
import { dbGet, dbAll, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { Request, Response } from 'express';

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const rules = await dbAll('SELECT * FROM attendance_rules WHERE business_id = $1', [businessId]);
    res.json(rules);
  } catch (error) {
    console.error('Error fetching attendance rules:', error);
    res.status(500).json({ error: 'Failed to fetch attendance rules' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const {
      rule_name,
      late_threshold_minutes,
      early_leave_threshold_minutes,
      overtime_start_hour
    } = req.body;

    if (!rule_name) {
      return res.status(400).json({ error: 'Rule name is required' });
    }

    const result = await dbRun(`
      INSERT INTO attendance_rules (
        business_id, rule_name, late_threshold_minutes, early_leave_threshold_minutes, overtime_start_hour
      ) VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [
      businessId, rule_name, late_threshold_minutes, early_leave_threshold_minutes, overtime_start_hour
    ]);

    const newRule = await dbGet('SELECT * FROM attendance_rules WHERE id = $1', [result.lastID]);
    res.status(201).json(newRule);
  } catch (error) {
    console.error('Error creating attendance rule:', error);
    res.status(500).json({ error: 'Failed to create attendance rule' });
  }
});

export default router;
