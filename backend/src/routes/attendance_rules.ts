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

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.userId;
    const ruleId = parseInt(req.params.id, 10);
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
      holiday_overtime,
      is_active,
    } = req.body;

    if (!ruleId || Number.isNaN(ruleId)) {
      return res.status(400).json({ error: 'Valid rule ID is required' });
    }

    if (!rule_name) {
      return res.status(400).json({ error: 'Rule name is required' });
    }

    const existingRule = await dbGet(
      'SELECT * FROM attendance_rules WHERE id = $1 AND business_id = $2',
      [ruleId, businessId]
    );

    if (!existingRule) {
      return res.status(404).json({ error: 'Attendance rule not found' });
    }

    await dbRun(`
      UPDATE attendance_rules
      SET
        rule_name = $1,
        late_grace_period = $2,
        late_penalty_type = $3,
        late_penalty_amount = $4,
        half_day_threshold = $5,
        overtime_threshold = $6,
        overtime_rate = $7,
        auto_clock_out = $8,
        auto_clock_out_time = $9,
        weekend_overtime = $10,
        holiday_overtime = $11,
        is_active = $12,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13 AND business_id = $14
    `, [
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
      holiday_overtime,
      is_active,
      ruleId,
      businessId,
    ]);

    const updatedRule = await dbGet('SELECT * FROM attendance_rules WHERE id = $1', [ruleId]);
    res.json(updatedRule);
  } catch (error) {
    console.error('Error updating attendance rule:', error);
    res.status(500).json({ error: 'Failed to update attendance rule' });
  }
});

export default router;
