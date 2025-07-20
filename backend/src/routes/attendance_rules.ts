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
      late_grace_period,
      late_penalty_type,
      late_penalty_amount,
      half_day_threshold,
      overtime_threshold,
      overtime_rate,
      auto_clock_out,
      auto_clock_out_time,
      weekend_overtime,
      holiday_overtime
    } = req.body;

    if (!rule_name) {
      return res.status(400).json({ error: 'Rule name is required' });
    }

    const result = await dbRun(`
      INSERT INTO attendance_rules (
        business_id, rule_name, late_grace_period, late_penalty_type, late_penalty_amount,
        half_day_threshold, overtime_threshold, overtime_rate, auto_clock_out,
        auto_clock_out_time, weekend_overtime, holiday_overtime
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      businessId, rule_name, late_grace_period, late_penalty_type, late_penalty_amount,
      half_day_threshold, overtime_threshold, overtime_rate, auto_clock_out,
      auto_clock_out_time, weekend_overtime, holiday_overtime
    ]);

    const newRule = await dbGet('SELECT * FROM attendance_rules WHERE id = $1', [result.lastID]);
    res.status(201).json(newRule);
  } catch (error) {
    console.error('Error creating attendance rule:', error);
    res.status(500).json({ error: 'Failed to create attendance rule' });
  }
});

export default router;
