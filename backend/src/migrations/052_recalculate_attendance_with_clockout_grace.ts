import { recalculateAllAttendanceStatuses } from '../utils/attendance_recalculation';

export const up = async () => {
  await recalculateAllAttendanceStatuses();
  console.log('Recalculated attendance using 30 minute clock-out grace rule');
};

export const down = async () => {
  console.log('No rollback needed for clock-out grace attendance recalculation');
};