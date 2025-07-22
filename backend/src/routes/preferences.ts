import express from 'express';
import { dbGet, dbRun } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = express.Router();
router.use(authenticateToken);

// Get user preferences
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    let preferences = await dbGet('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);

    if (!preferences) {
      // Create default preferences if none exist
      const defaultPreferences = {
        email_notifications: true,
        push_notifications: false,
        weekly_reports: true,
        monthly_summary: true,
        currency: 'USD',
        date_format: 'MM/DD/YYYY',
        theme: 'light'
      };

      await dbRun(
        'INSERT INTO user_preferences (user_id, email_notifications, push_notifications, weekly_reports, monthly_summary, currency, date_format, theme) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [userId, ...Object.values(defaultPreferences)]
      );
      preferences = await dbGet('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
    }
    
    res.json({ success: true, data: preferences });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update user preferences
router.put('/', [
    body('email_notifications').isBoolean(),
    body('push_notifications').isBoolean(),
    body('weekly_reports').isBoolean(),
    body('monthly_summary').isBoolean(),
    body('currency').isIn(['USD', 'EUR', 'GBP', 'JPY', 'PKR']),
    body('date_format').isIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']),
    body('theme').isIn(['light', 'dark', 'auto'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const userId = req.user!.userId;
    const {
      email_notifications,
      push_notifications,
      weekly_reports,
      monthly_summary,
      currency,
      date_format,
      theme
    } = req.body;

    await dbRun(
      `UPDATE user_preferences SET 
        email_notifications = $1, 
        push_notifications = $2, 
        weekly_reports = $3, 
        monthly_summary = $4, 
        currency = $5, 
        date_format = $6, 
        theme = $7
      WHERE user_id = $8`,
      [
        email_notifications,
        push_notifications,
        weekly_reports,
        monthly_summary,
        currency,
        date_format,
        theme,
        userId
      ]
    );

    res.json({ success: true, message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
