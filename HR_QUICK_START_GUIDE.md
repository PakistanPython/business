# HR System Quick Start Guide

## Getting Started with Enhanced HR Features

### Prerequisites
- Backend server running on port 5000
- Frontend application accessible
- Admin or HR manager access

### Step 1: Initial Setup

#### Configure Attendance Rules (Essential First Step)
1. Go to **Employees** → **Attendance Rules** tab
2. Click **"Add Rule"**
3. Configure basic settings:
   ```
   Rule Name: Standard Working Hours
   Late Grace Period: 15 minutes
   Late Penalty Type: No Penalty (initially)
   Half Day Threshold: 240 minutes (4 hours)
   Overtime Threshold: 480 minutes (8 hours)
   Overtime Rate: 1.5x
   ```
4. Enable **Weekend Overtime** and **Holiday Overtime**
5. Click **"Create Rule"** and ensure it's **Active**

#### Set Up Leave Types
1. Go to **Employees** → **Leave Types** tab
2. Create these basic leave types:

   **Annual Leave:**
   ```
   Name: Annual Leave
   Description: Yearly vacation leave
   Max Days Per Year: 21
   Max Days Per Month: 5
   Paid Leave: Yes
   Carry Forward: Yes
   Requires Approval: Yes
   ```

   **Sick Leave:**
   ```
   Name: Sick Leave
   Description: Medical leave
   Max Days Per Year: 10
   Max Days Per Month: 3
   Paid Leave: Yes
   Carry Forward: No
   Requires Approval: Yes
   ```

   **Personal Leave:**
   ```
   Name: Personal Leave
   Description: Personal time off
   Max Days Per Year: 5
   Max Days Per Month: 2
   Paid Leave: No
   Carry Forward: No
   Requires Approval: Yes
   ```

### Step 2: Employee Management

#### Add New Employees
1. Go to **Employees** → **Employees** tab
2. Click **"Add Employee"**
3. Fill in basic information:
   - Personal details (name, email, phone)
   - Employment details (hire date, type, department)
   - Salary information
4. Enable **"Create login account"** if needed
5. Click **"Create Employee"**

#### Set Up Work Schedules
1. After adding employees, go to **Work Schedules** tab
2. Click **"Add Schedule"**
3. Configure standard schedule:
   ```
   Employee: Select employee
   Schedule Name: Standard 9-5
   Effective From: Current date
   Monday-Friday: 09:00 - 17:00
   Saturday-Sunday: Off (no times)
   Break Duration: 60 minutes
   Weekly Hours: 40
   ```
4. Enable **Active** status
5. Repeat for all employees

#### Configure Leave Entitlements
1. For each employee, set up annual leave entitlements:
   - Navigate to leave management
   - Assign annual leave days based on company policy
   - Example: 21 days annual leave, 10 days sick leave

### Step 3: Daily Operations

#### Employee Clock In/Out
Employees can now:
1. Clock in at start of workday
2. System automatically calculates if they're late
3. Clock out at end of workday
4. System calculates total hours and overtime

#### Leave Requests
Employees can:
1. Submit leave requests
2. System validates against available balance
3. Managers approve/reject requests
4. Approved leave affects attendance records

#### Attendance Monitoring
Managers can:
1. View daily attendance records
2. Monitor late arrivals and early departures
3. Review overtime hours
4. Generate monthly attendance reports

### Step 4: Payroll Integration

#### Monthly Payroll Process
1. Ensure all attendance is recorded for the month
2. Review and approve any manual attendance entries
3. Generate payroll using **"Bulk Create"** feature
4. System automatically calculates:
   - Basic salary based on present days
   - Overtime payments
   - Leave deductions
5. Review and adjust before marking as **"Paid"**

### Step 5: Reporting and Analytics

#### Available Reports
1. **Employee Overview**: Total employees, active/inactive counts
2. **Attendance Summary**: Monthly attendance statistics
3. **Leave Balance**: Employee leave utilization
4. **Payroll Summary**: Salary distribution and costs

### Common Workflows

#### New Employee Onboarding
```
1. Add employee with basic details
2. Create work schedule
3. Set up leave entitlements
4. Provide login credentials (if created)
5. Train on clock in/out process
```

#### Monthly Attendance Review
```
1. Check attendance summary for the month
2. Review any late/absent days
3. Approve manual attendance entries
4. Generate attendance report
5. Use data for payroll processing
```

#### Leave Request Process
```
Employee: Submit leave request
System: Validate balance and overlaps
Manager: Review and approve/reject
System: Update leave balance if approved
```

### Tips for Success

#### Best Practices
- Set up attendance rules before employees start using the system
- Configure work schedules for all employees immediately
- Regularly review and update leave policies
- Use bulk operations for efficiency
- Generate reports monthly for tracking

#### Common Pitfalls to Avoid
- Don't forget to activate attendance rules and work schedules
- Ensure leave entitlements are set up before employees request leave
- Regularly backup attendance data
- Train employees on proper clock in/out procedures

#### Customization Options
- Adjust attendance rules based on company culture
- Create additional leave types as needed
- Set different work schedules for different roles
- Configure overtime policies to match local regulations

### Support and Troubleshooting

#### If Employees Can't Clock In
1. Check if work schedule is configured and active
2. Verify attendance rules are set up
3. Ensure employee record is active

#### If Overtime Isn't Calculating
1. Check attendance rules configuration
2. Verify overtime threshold settings
3. Ensure clock out time is recorded

#### If Leave Requests Are Rejected
1. Check leave balance and entitlements
2. Verify leave type allows the requested amount
3. Check for overlapping requests

### Next Steps

Once basic setup is complete:
1. Train all employees on the new system
2. Monitor usage for the first month
3. Adjust rules and policies based on feedback
4. Explore advanced features like mobile integration
5. Set up automated reports for management

This quick start guide should help you get the enhanced HR system up and running efficiently. For detailed technical information, refer to the complete HR Enhancement Documentation.