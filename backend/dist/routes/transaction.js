"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const database_1 = require("../config/database");
const json2csv_1 = __importDefault(require("json2csv"));
const router = express_1.default.Router();
router.get('/download', auth_1.authenticateToken, async (req, res) => {
    try {
        const businessId = req.user.businessId;
        const transactions = await (0, database_1.dbAll)(`
      SELECT 'income' as type, date, description, amount FROM income WHERE business_id = $1
      UNION ALL
      SELECT 'expense' as type, date, description, amount FROM expenses WHERE business_id = $1
      UNION ALL
      SELECT 'purchase' as type, date, description, amount FROM purchases WHERE business_id = $1
      UNION ALL
      SELECT 'sale' as type, date, description, selling_price as amount FROM sales WHERE business_id = $1
    `, [businessId]);
        const csv = json2csv_1.default.parse(transactions);
        res.header('Content-Type', 'text/csv');
        res.attachment(`transactions-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    }
    catch (error) {
        console.error('Transaction backup failed:', error);
        res.status(500).json({ success: false, message: 'Transaction backup failed' });
    }
});
exports.default = router;
