import { recalculateAllAttendanceStatuses } from '../utils/attendance_recalculation';

export const up = async () => {
  await recalculateAllAttendanceStatuses();
  console.log('Recalculated existing attendance statuses using work schedule thresholds');
};

export const down = async () => {
  console.log('No rollback needed for recalculated attendance statuses');
};