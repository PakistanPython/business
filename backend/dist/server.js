"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./config/database");
const auth_1 = __importDefault(require("./routes/auth"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const income_1 = __importDefault(require("./routes/income"));
const expense_1 = __importDefault(require("./routes/expense"));
const purchase_1 = __importDefault(require("./routes/purchase"));
const sale_1 = __importDefault(require("./routes/sale"));
const account_1 = __importDefault(require("./routes/account"));
const loan_1 = __importDefault(require("./routes/loan"));
const charity_1 = __importDefault(require("./routes/charity"));
const category_1 = __importDefault(require("./routes/category"));
const employees_1 = __importDefault(require("./routes/employees"));
const attendance_1 = __importDefault(require("./routes/attendance"));
const payroll_1 = __importDefault(require("./routes/payroll"));
const accounts_receivable_1 = __importDefault(require("./routes/accounts_receivable"));
const accounts_payable_1 = __importDefault(require("./routes/accounts_payable"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
const corsOrigin = process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || 'https://your-frontend-domain.com'
    : process.env.FRONTEND_URL || 'http://localhost:5173';
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
}));
app.use((0, cors_1.default)({
    origin: corsOrigin,
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use((0, morgan_1.default)('combined'));
app.use((0, compression_1.default)());
app.use(limiter);
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/income', income_1.default);
app.use('/api/expenses', expense_1.default);
app.use('/api/purchases', purchase_1.default);
app.use('/api/sales', sale_1.default);
app.use('/api/accounts', account_1.default);
app.use('/api/loans', loan_1.default);
app.use('/api/charity', charity_1.default);
app.use('/api/categories', category_1.default);
app.use('/api/employees', employees_1.default);
app.use('/api/attendance', attendance_1.default);
app.use('/api/payroll', payroll_1.default);
app.use('/api/accounts-receivable', accounts_receivable_1.default);
app.use('/api/accounts-payable', accounts_payable_1.default);
app.get('/', (req, res) => {
    res.json({
        message: 'My Business API Server is running!',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: 'PostgreSQL'
    });
});
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON format'
        });
    }
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});
const startServer = async () => {
    try {
        await (0, database_1.testConnection)();
        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`💾 Database: PostgreSQL`);
            console.log(`🌐 CORS Origin: ${corsOrigin}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
});
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT. Graceful shutdown...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
    process.exit(0);
});
startServer();
