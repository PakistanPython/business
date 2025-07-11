# HR System Testing Guide

## 🧪 Complete Testing Checklist for Deployed HR System

### Prerequisites for Testing
- ✅ Backend server is running and accessible
- ✅ Frontend application loads successfully
- ✅ Admin/Manager user account available
- ✅ Database is initialized with new HR tables

---

## 📋 Phase 1: Initial Setup Testing

### 1. **Test Attendance Rules Configuration**
**What to test**: Basic attendance policy setup

**Steps**:
1. Navigate to **Employees** → **Attendance Rules** tab
2. Click **"Add Rule"**
3. Create test rule:
   ```
   Rule Name: "Test Standard Hours"
   Late Grace Period: 15 minutes
   Late Penalty Type: No Penalty
   Half Day Threshold: 240 minutes
   Overtime Threshold: 480 minutes
   Overtime Rate: 1.5
   Weekend Overtime: Yes
   Holiday Overtime: Yes
   ```
4. Save and verify it appears in the list
5. **Activate** the rule (should show green "Active" badge)

**Expected Result**: ✅ Rule created successfully and marked as active

---

### 2. **Test Leave Types Setup**
**What to test**: Leave category configuration

**Steps**:
1. Go to **Employees** → **Leave Types** tab
2. Create **Annual Leave**:
   ```
   Name: Annual Leave
   Description: Yearly vacation time
   Max Days Per Year: 21
   Max Days Per Month: 5
   Paid Leave: Yes
   Carry Forward: Yes
   Requires Approval: Yes
   Color: Blue (#3B82F6)
   ```
3. Create **Sick Leave**:
   ```
   Name: Sick Leave
   Description: Medical leave
   Max Days Per Year: 10
   Max Days Per Month: 3
   Paid Leave: Yes
   Carry Forward: No
   Requires Approval: Yes
   Color: Red (#EF4444)
   ```
4. Verify both appear as cards with correct colors

**Expected Result**: ✅ Leave types created with proper configuration and color coding

---

## 👥 Phase 2: Employee Management Testing

### 3. **Test Employee Creation with Enhanced Features**
**What to test**: New employee setup with HR integration

**Steps**:
1. Go to **Employees** → **Employees** tab
2. Click **"Add Employee"**
3. Create test employee:
   ```
   First Name: John
   Last Name: Doe
   Email: john.doe@test.com
   Phone: (555) 123-4567
   Hire Date: Today's date
   Employment Type: Full Time
   Salary Type: Monthly
   Base Salary: 5000
   Department: IT
   Position: Developer
   Create Login: Yes
   ```
4. Verify employee appears in list with generated employee code
5. Check if login credentials are provided (if enabled)

**Expected Result**: ✅ Employee created successfully with auto-generated employee code

---

### 4. **Test Work Schedule Creation**
**What to test**: Employee work schedule assignment

**Steps**:
1. Go to **Employees** → **Work Schedules** tab
2. Click **"Add Schedule"**
3. Configure schedule:
   ```
   Employee: John Doe
   Schedule Name: Standard 9-5
   Effective From: Today's date
   Monday: 09:00 - 17:00
   Tuesday: 09:00 - 17:00
   Wednesday: 09:00 - 17:00
   Thursday: 09:00 - 17:00
   Friday: 09:00 - 17:00
   Saturday: Off
   Sunday: Off
   Break Duration: 60 minutes
   Weekly Hours: 40
   Active: Yes
   ```
4. Save and verify schedule appears in list
5. Check that it shows as "Active" with green badge

**Expected Result**: ✅ Work schedule created and marked as active

---

## ⏰ Phase 3: Attendance System Testing

### 5. **Test Clock In Functionality**
**What to test**: Smart clock-in with work schedule integration

**Steps**:
1. Go to **Attendance** page
2. Test clock-in for John Doe:
   - If before 9:15 AM: Should be "On Time"
   - If after 9:15 AM: Should calculate late minutes
3. Check that system creates attendance record with:
   - Correct clock-in time
   - Late minutes (if applicable)
   - Status based on timing

**API Test** (Optional):
```bash
POST /api/attendance/clock-in
{
  "employee_id": [John's ID],
  "entry_method": "manual",
  "notes": "Test clock in"
}
```

**Expected Result**: ✅ Clock-in recorded with automatic late calculation

---

### 6. **Test Clock Out with Overtime Calculation**
**What to test**: Clock-out with automatic hour calculation

**Steps**:
1. Clock out the same employee after 8+ hours
2. Verify system calculates:
   - Total working hours
   - Overtime hours (if > 8 hours)
   - Final attendance status
3. Check that break time is properly deducted

**Expected Result**: ✅ Clock-out recorded with correct hour calculations and overtime

---

## 🏖️ Phase 4: Leave Management Testing

### 7. **Test Leave Entitlement Setup**
**What to test**: Annual leave allocation

**Steps**:
1. Navigate to leave entitlements
2. Set up entitlements for John Doe:
   ```
   Employee: John Doe
   Leave Type: Annual Leave
   Year: 2025
   Total Days: 21
   Carried Forward: 0
   ```
3. Repeat for Sick Leave (10 days)
4. Verify entitlements show correct remaining balance

**Expected Result**: ✅ Leave entitlements configured with correct balances

---

### 8. **Test Leave Request Workflow**
**What to test**: Employee leave request and approval process

**Steps**:
1. Create leave request for John Doe:
   ```
   Leave Type: Annual Leave
   Start Date: Next Monday
   End Date: Next Friday (5 working days)
   Reason: Family vacation
   ```
2. Verify system:
   - Calculates working days correctly
   - Validates against available balance
   - Creates request with "Pending" status
3. Test approval process:
   - Approve the request
   - Check that leave balance is updated
   - Verify status changes to "Approved"

**Expected Result**: ✅ Leave request created, approved, and balance updated automatically

---

## 💰 Phase 5: Payroll Integration Testing

### 9. **Test Payroll Generation**
**What to test**: Automatic payroll calculation based on attendance

**Steps**:
1. Ensure John Doe has several days of attendance records
2. Go to **Payroll** page
3. Create payroll record:
   ```
   Employee: John Doe
   Pay Period: Start of month to today
   Auto Calculate: Yes
   ```
4. Verify system calculates:
   - Basic salary based on present days
   - Overtime amount (if any)
   - Total working days and hours
5. Check gross and net salary calculations

**Expected Result**: ✅ Payroll generated with automatic calculations from attendance data

---

## 📊 Phase 6: Reporting and Analytics Testing

### 10. **Test HR Reports**
**What to test**: Various analytics and reporting features

**Steps**:
1. Go to **Employees** → **HR Reports** tab
2. Check employee overview statistics:
   - Total employees count
   - Active/inactive breakdown
   - Department distribution
3. Test attendance summary:
   - Monthly attendance statistics
   - Present/absent/late day counts
   - Average working hours
4. Test leave balance report:
   - Employee leave utilization
   - Remaining balances by type

**Expected Result**: ✅ All reports display accurate data based on test records

---

## 🔧 Phase 7: Advanced Features Testing

### 11. **Test Attendance Rules Application**
**What to test**: Rules engine working correctly

**Steps**:
1. Create attendance record with late clock-in (after grace period)
2. Verify system applies late penalty according to rules
3. Test half-day marking:
   - Clock in and out with < 4 hours
   - Verify marked as "Half Day"
4. Test overtime calculation:
   - Work > 8 hours
   - Verify overtime hours calculated at 1.5x rate

**Expected Result**: ✅ Attendance rules applied correctly in all scenarios

---

### 12. **Test Data Integrity and Relationships**
**What to test**: Database relationships and data consistency

**Steps**:
1. Try to delete employee with attendance records
2. Verify proper cascade or restriction
3. Update work schedule and check attendance calculations
4. Test leave request validation against entitlements
5. Verify payroll calculations update when attendance changes

**Expected Result**: ✅ All data relationships maintain integrity

---

## 🚨 Common Issues to Watch For

### Potential Problems and Solutions:

**Clock-in Fails**:
- ✅ Check: Work schedule is configured and active
- ✅ Check: Attendance rules are set up
- ✅ Check: Employee record is active

**Overtime Not Calculating**:
- ✅ Check: Attendance rules have correct overtime threshold
- ✅ Check: Work schedule has proper daily hours
- ✅ Check: Clock-out time is recorded

**Leave Request Rejected**:
- ✅ Check: Employee has sufficient leave balance
- ✅ Check: Leave type allows requested amount
- ✅ Check: No overlapping leave requests

**Payroll Calculation Errors**:
- ✅ Check: Attendance data is complete for pay period
- ✅ Check: Employee salary information is correct
- ✅ Check: Attendance rules are properly configured

---

## ✅ Testing Completion Checklist

Mark off each item as you complete testing:

- [ ] Attendance rules created and activated
- [ ] Leave types configured with proper settings
- [ ] Employee created with complete information
- [ ] Work schedule assigned and activated
- [ ] Clock-in/out working with rule calculations
- [ ] Leave entitlements set up correctly
- [ ] Leave request workflow functional
- [ ] Payroll generation working automatically
- [ ] All reports displaying accurate data
- [ ] Data integrity maintained across operations
- [ ] Error handling working for edge cases

---

## 🎯 Next Steps After Testing

Once testing is complete:

1. **Production Setup**: Configure real employee data
2. **User Training**: Train staff on new features
3. **Policy Setup**: Finalize attendance and leave policies
4. **Ongoing Monitoring**: Regular system health checks
5. **Feedback Collection**: Gather user feedback for improvements

---

**Need Help?** If you encounter any issues during testing, let me know the specific error messages or unexpected behavior, and I'll help you troubleshoot!