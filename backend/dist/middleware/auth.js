"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBusinessAccess = exports.requireAdmin = exports.requireEmployee = exports.requireBusinessOwner = exports.requireRole = exports.optionalAuth = exports.authenticateToken = void 0;
const jwt_1 = require("../utils/jwt");
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Access token required'
            });
            return;
        }
        const decoded = (0, jwt_1.verifyToken)(token);
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(403).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};
exports.authenticateToken = authenticateToken;
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            const decoded = (0, jwt_1.verifyToken)(token);
            req.user = decoded;
        }
        next();
    }
    catch (error) {
        next();
    }
};
exports.optionalAuth = optionalAuth;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
                return;
            }
            if (!allowedRoles.includes(req.user.userType)) {
                res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions'
                });
                return;
            }
            next();
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: 'Authorization error'
            });
        }
    };
};
exports.requireRole = requireRole;
exports.requireBusinessOwner = (0, exports.requireRole)(['business_owner', 'admin']);
exports.requireEmployee = (0, exports.requireRole)(['employee', 'business_owner', 'admin']);
exports.requireAdmin = (0, exports.requireRole)(['admin']);
const checkBusinessAccess = (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }
        const requestedBusinessId = req.params.businessId || req.body.business_id || req.query.business_id;
        if (req.user.userType === 'business_owner') {
            if (requestedBusinessId && parseInt(requestedBusinessId) !== req.user.userId) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied to this business'
                });
                return;
            }
        }
        if (req.user.userType === 'employee') {
            if (requestedBusinessId && req.user.businessId && parseInt(requestedBusinessId) !== req.user.businessId) {
                res.status(403).json({
                    success: false,
                    message: 'Access denied to this business'
                });
                return;
            }
        }
        next();
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Business access check error'
        });
    }
};
exports.checkBusinessAccess = checkBusinessAccess;
