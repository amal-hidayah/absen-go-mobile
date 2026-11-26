import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/jakarta_time.dart';
import '../models/employee.dart';
import '../models/attendance.dart';
import '../supabase_client.dart';

class PayrollEmployeeSummary {
  final Employee employee;
  final int daysPaid; // Hadir lengkap (jam masuk & keluar ada, status hadir/terlambat)
  final int onTimeCount; // Hadir tepat waktu lengkap
  final int lateCount; // Terlambat lengkap
  final int incompleteCount; // Hadir/terlambat tapi belum ada clock_out atau clock_in
  final int leaveCount; // Izin, sakit, alfa
  final double totalSalary; // daysPaid * dailySalary
  final List<Attendance> attendanceRecords;

  const PayrollEmployeeSummary({
    required this.employee,
    required this.daysPaid,
    required this.onTimeCount,
    required this.lateCount,
    required this.incompleteCount,
    required this.leaveCount,
    required this.totalSalary,
    required this.attendanceRecords,
  });
}

class PayrollOverallSummary {
  final double totalExpense;
  final int totalDaysWorked;
  final int eligibleEmployeeCount;
  final List<PayrollEmployeeSummary> employeeSummaries;

  const PayrollOverallSummary({
    required this.totalExpense,
    required this.totalDaysWorked,
    required this.eligibleEmployeeCount,
    required this.employeeSummaries,
  });
}

final payrollRepositoryProvider = Provider<PayrollRepository>((ref) {
  return PayrollRepository(ref.watch(supabaseProvider));
});

class PayrollRepository {
  final SupabaseClient _supabase;

  PayrollRepository(this._supabase);

  /// Menghitung penggajian untuk seluruh karyawan aktif dalam rentang tanggal tertentu
  Future<PayrollOverallSummary> calculatePayroll({
    required DateTime startDate,
    required DateTime endDate,
  }) async {
    final startStr = JakartaTime.formatIsoDate(startDate);
    final endStr = JakartaTime.formatIsoDate(endDate);

    // 1. Ambil seluruh karyawan aktif
    final empRes = await _supabase
        .from('employees')
        .select()
        .eq('active', true)
        .order('full_name');

    final employees = (empRes as List).map((row) => Employee.fromJson(row)).toList();

    // 2. Ambil seluruh catatan presensi dalam rentang periode
    final attRes = await _supabase
        .from('company_attendance')
        .select()
        .gte('attend_date', startStr)
        .lte('attend_date', endStr);

    final allAttendances = (attRes as List).map((row) => Attendance.fromJson(row)).toList();

    // Petakan presensi per employee_id
    final attByEmp = <String, List<Attendance>>{};
    for (final att in allAttendances) {
      attByEmp.putIfAbsent(att.employeeId, () => []).add(att);
    }

    double totalExpense = 0;
    int totalDaysWorked = 0;
    final summaries = <PayrollEmployeeSummary>[];

    for (final emp in employees) {
      final records = attByEmp[emp.id] ?? [];

      int daysPaid = 0;
      int onTimeCount = 0;
      int lateCount = 0;
      int incompleteCount = 0;
      int leaveCount = 0;

      for (final r in records) {
        if (r.isComplete) {
          daysPaid++;
          if (r.status == 'hadir') {
            onTimeCount++;
          } else if (r.status == 'terlambat') {
            lateCount++;
          }
        } else if (r.isIncomplete) {
          incompleteCount++;
        } else if (r.status == 'izin' || r.status == 'sakit' || r.status == 'alfa') {
          leaveCount++;
        }
      }

      final salary = daysPaid * emp.dailySalary;
      totalExpense += salary;
      totalDaysWorked += daysPaid;

      summaries.add(PayrollEmployeeSummary(
        employee: emp,
        daysPaid: daysPaid,
        onTimeCount: onTimeCount,
        lateCount: lateCount,
        incompleteCount: incompleteCount,
        leaveCount: leaveCount,
        totalSalary: salary,
        attendanceRecords: records,
      ));
    }

    return PayrollOverallSummary(
      totalExpense: totalExpense,
      totalDaysWorked: totalDaysWorked,
      eligibleEmployeeCount: employees.length,
      employeeSummaries: summaries,
    );
  }
}
