"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
const attendance_recalculation_1 = require("../utils/attendance_recalculation");
const up = async () => {
    await (0, attendance_recalculation_1.recalculateAllAttendanceStatuses)();
    console.log('Recalculated attendance using 30 minute clock-out grace rule');
};
exports.up = up;
const down = async () => {
    console.log('No rollback needed for clock-out grace attendance recalculation');
};
exports.down = down;
