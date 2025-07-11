# HR Enhancement Documentation

## Overview

This document outlines the comprehensive HR enhancements made to the business management system. The enhancements include advanced employee management, work scheduling, leave management, attendance tracking with rules, and improved payroll integration.

## New Features Added

### 1. Work Schedules Management
- **Purpose**: Define and manage employee work schedules with specific duty timings
- **Features**:
  - Flexible weekly schedules (different times for each day)
  - Effective date ranges for schedule changes
  - Break duration configuration
  - Weekly hours tracking
  - Active/inactive schedule management

### 2. Leave Management System
- **Leave Types**: Configure different types of leaves (Annual, Sick, Personal, etc.)
  - Maximum days per year/month limits
  - Carry forward rules
  - Paid/unpaid leave configuration
  - Approval requirements
  - Color coding for visual identification

- **Leave Entitlements**: Annual leave allocations for employees
  - Automatic balance calculations
  - Carry forward from previous year
  - Real-time remaining days tracking

- **Leave Requests**: Employee leave application system
  - Working days calculation
  - Balance validation
  - Approval workflow
  - Overlap prevention

### 3. Advanced Attendance Tracking
- **Smart Clock In/Out**: 
  - Work schedule integration
  - Automatic late calculation
  - Location tracking (GPS coordinates)
  - Multiple entry methods (manual, biometric, RFID, mobile)

- **Attendance Rules Engine**:
  - Late grace period configuration
  - Late penalty types (deduction, half-day, warning)
  - Half-day threshold settings
  - Overtime calculation rules
  - Auto clock-out functionality
  - Weekend/holiday overtime policies

### 4. Enhanced Payroll Integration
- **Automatic Calculations**:
  - Integration with attendance data
  - Overtime calculations based on rules
  - Leave deductions
  - Multiple salary types (monthly, daily, hourly)

- **Comprehensive Payroll Records**:
  - Basic salary calculation
  - Overtime amounts
  - Bonuses and allowances
  - Multiple deduction types
  - Payment tracking and status

### 5. HR Analytics & Reporting
- **Employee Overview**: Statistics and departmental breakdown
- **Attendance Summary**: Monthly tracking and analytics
- **Leave Balance Reports**: Employee leave utilization
- **Payroll Summary**: Salary distribution and costs

## Database Schema Changes

### New Tables Added

#### 1. `employee_work_schedules`
```sql
- id: Primary key
- employee_id: Reference to employees table
- schedule_name: Human-readable schedule name
- effective_from/to: Date range for schedule validity
- [day]_start/end: Start and end times for each day of week
- break_duration: Break time in minutes
- weekly_hours: Expected weekly working hours
- is_active: Current active schedule flag
```

#### 2. `leave_types`
```sql
- id: Primary key
- business_id: Reference to business
- name: Leave type name (e.g., Annual Leave)
- description: Description of leave type
- max_days_per_year/month: Maximum allowed days
- carry_forward: Allow carrying forward unused days
- is_paid: Paid or unpaid leave
- requires_approval: Approval workflow requirement
- advance_notice_days: Minimum notice period
- color: UI color coding
```

#### 3. `employee_leave_entitlements`
```sql
- id: Primary key
- employee_id: Reference to employee
- leave_type_id: Reference to leave type
- year: Calendar year
- total_days: Total entitled days
- used_days: Days already used
- remaining_days: Calculated remaining days
- carried_forward: Days carried from previous year
```

#### 4. `employee_leave_requests`
```sql
- id: Primary key
- employee_id: Reference to employee
- leave_type_id: Reference to leave type
- start_date/end_date: Leave period
- total_days: Total days requested
- reason: Reason for leave
- status: pending/approved/rejected/cancelled
- approved_by: Manager who approved
- rejection_reason: Reason if rejected
- emergency_contact: Contact during leave
- handover_notes: Work handover information
```

#### 5. `attendance_rules`
```sql
- id: Primary key
- business_id: Reference to business
- rule_name: Name of the rule set
- late_grace_period: Grace period for lateness (minutes)
- late_penalty_type: Type of penalty for late arrival
- late_penalty_amount: Amount of penalty
- half_day_threshold: Minimum hours for full day
- overtime_threshold: Hours after which overtime applies
- overtime_rate: Overtime multiplier (e.g., 1.5x)
- auto_clock_out: Automatic clock out feature
- weekend_overtime/holiday_overtime: Special overtime rules
```

#### 6. Enhanced `attendance` table
```sql
- All previous fields plus:
- late_minutes: Minutes late for work
- early_departure_minutes: Minutes left early
- attendance_type: regular/overtime/holiday/weekend
- entry_method: manual/biometric/rfid/mobile
- location_latitude/longitude: GPS coordinates
- approved_by: Manager approval for manual entries
```

#### 7. Enhanced `payroll` table
```sql
- All basic payroll fields plus:
- Enhanced deduction types (tax, insurance, loan, leave)
- Automatic gross/net salary calculations
- Working days tracking
- Overtime hours integration
- Payment method and reference tracking
```

#### 8. `employee_attendance_summary`
```sql
- Monthly summary table for performance
- Pre-calculated attendance statistics
- Average check-in/out times
- Overtime and working hours totals
```

## API Endpoints Added

### Work Schedules (`/api/work-schedules`)
- `GET /` - List all work schedules
- `GET /:id` - Get specific schedule
- `POST /` - Create new schedule
- `PUT /:id` - Update schedule
- `DELETE /:id` - Delete schedule
- `GET /employee/:employeeId/current` - Get current active schedule

### Leave Management (`/api/leaves`)
- `GET /types` - List leave types
- `POST /types` - Create leave type
- `GET /entitlements` - List leave entitlements
- `POST /entitlements` - Create/update entitlements
- `GET /requests` - List leave requests
- `POST /requests` - Create leave request
- `PUT /requests/:id/approve` - Approve/reject request
- `GET /balance/:employeeId` - Get leave balance

### Attendance Rules (`/api/attendance-rules`)
- `GET /` - List all rules
- `GET /active` - Get active rule
- `POST /` - Create new rule
- `PUT /:id` - Update rule
- `DELETE /:id` - Delete rule
- `POST /:id/activate` - Activate specific rule

### Enhanced Attendance (`/api/attendance`)
- Enhanced clock-in/out with work schedule integration
- Automatic late calculation
- Overtime calculation based on rules
- Location tracking support
- Manual attendance entry with validations

## Frontend Enhancements

### Employee Page Redesign
The employee page now includes a tabbed interface with:

1. **Employees Tab**: Enhanced employee listing with schedule management actions
2. **Work Schedules Tab**: Visual schedule management interface
3. **Leave Types Tab**: Leave type configuration with color coding
4. **Attendance Rules Tab**: Policy configuration interface
5. **HR Reports Tab**: Analytics and reporting dashboard

### New UI Components
- Work schedule creation dialog with weekly time selection
- Leave type configuration with visual indicators
- Attendance rule builder with policy options
- Enhanced employee actions dropdown
- HR statistics cards and summaries

## Configuration Guide

### Setting Up Work Schedules
1. Navigate to Employees → Work Schedules tab
2. Click "Add Schedule"
3. Select employee and enter schedule name
4. Set effective date range
5. Configure weekly working hours for each day
6. Set break duration and weekly hours
7. Activate the schedule

### Configuring Leave Types
1. Go to Employees → Leave Types tab
2. Click "Add Leave Type"
3. Enter leave type details:
   - Name and description
   - Maximum days per year/month
   - Carry forward rules
   - Paid/unpaid status
   - Approval requirements
   - Color coding

### Setting Up Attendance Rules
1. Navigate to Employees → Attendance Rules tab
2. Click "Add Rule"
3. Configure rule parameters:
   - Late grace period
   - Penalty types and amounts
   - Half-day and overtime thresholds
   - Auto clock-out settings
   - Weekend/holiday policies
4. Activate the rule

## Best Practices

### Work Schedules
- Create different schedules for different employee types
- Use descriptive names for easy identification
- Set realistic break durations
- Plan schedule changes in advance with effective dates

### Leave Management
- Set up leave types before adding employees
- Configure realistic annual allocations
- Enable carry forward for unused vacation days
- Require approval for all leave types initially

### Attendance Rules
- Start with lenient rules and adjust based on company culture
- Consider different rules for different employee categories
- Regularly review and update overtime policies
- Enable auto clock-out to prevent inflated hours

### Payroll Integration
- Ensure attendance rules are configured before running payroll
- Regularly review overtime calculations
- Set up appropriate deduction categories
- Use bulk payroll creation for efficiency

## Technical Implementation Notes

### Database Relationships
- All new tables properly use foreign keys for data integrity
- Indexes added for query performance
- Generated columns for automatic calculations
- Proper cascade deletions configured

### Security Considerations
- All routes protected with authentication middleware
- User type-based access control implemented
- Employee data isolation by business_id
- Sensitive payroll data properly secured

### Performance Optimizations
- Summary tables for frequently accessed data
- Proper indexing on commonly queried fields
- Pagination implemented for large datasets
- Efficient query patterns used

## Migration Notes

### From Previous Version
1. Database schema will be automatically updated on first run
2. Existing employee data remains intact
3. Default attendance rules will need to be configured
4. Work schedules should be set up for all employees
5. Leave types and entitlements need initial configuration

### Data Migration Recommendations
1. Export existing employee data before upgrade
2. Configure basic attendance rules before employee use
3. Set up default work schedules (e.g., 9 AM - 5 PM)
4. Initialize leave entitlements for current year
5. Test payroll calculations with sample data

## Troubleshooting

### Common Issues
1. **Clock-in failures**: Check if work schedule is configured
2. **Incorrect overtime calculations**: Verify attendance rules settings
3. **Leave request rejections**: Check leave balance and entitlements
4. **Payroll discrepancies**: Ensure attendance data is complete

### Support Information
- Check application logs for detailed error messages
- Verify database connections and table existence
- Ensure all required fields are properly configured
- Contact system administrator for complex issues

## Future Enhancements

### Planned Features
1. Mobile app for employee self-service
2. Biometric integration support
3. Advanced reporting and analytics
4. Performance management integration
5. Recruitment and onboarding modules
6. Training and certification tracking
7. Asset management integration
8. Advanced workflow approvals

This comprehensive HR enhancement provides a solid foundation for managing all aspects of human resources in your business management system.