import 'employee.dart';
import 'attendance_evidence.dart';

class Attendance {
  final String id;
  final String employeeId;
  final String attendDate; // YYYY-MM-DD
  final String? clockIn;
  final String? clockOut;
  final String status; // 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alfa'
  final int lateMinutes;
  final String? note;
  final Employee? employee;
  final List<AttendanceEvidence> evidences;

  const Attendance({
    required this.id,
    required this.employeeId,
    required this.attendDate,
    this.clockIn,
    this.clockOut,
    required this.status,
    required this.lateMinutes,
    this.note,
    this.employee,
    this.evidences = const [],
  });

  factory Attendance.fromJson(Map<String, dynamic> json) {
    Employee? emp;
    if (json['employees'] != null && json['employees'] is Map<String, dynamic>) {
      emp = Employee.fromJson(json['employees'] as Map<String, dynamic>);
    }

    final evList = <AttendanceEvidence>[];
    if (json['attendance_evidence'] != null && json['attendance_evidence'] is List) {
      for (final e in (json['attendance_evidence'] as List)) {
        if (e is Map<String, dynamic>) {
          evList.add(AttendanceEvidence.fromJson(e));
        }
      }
    }

    return Attendance(
      id: json['id'] as String,
      employeeId: json['employee_id'] as String,
      attendDate: json['attend_date'] as String? ?? '',
      clockIn: json['clock_in'] as String?,
      clockOut: json['clock_out'] as String?,
      status: json['status'] as String? ?? 'hadir',
      lateMinutes: (json['late_minutes'] as num?)?.toInt() ?? 0,
      note: json['note'] as String?,
      employee: emp,
      evidences: evList,
    );
  }

  /// Gaji dihitung jika status hadir/terlambat dan jam masuk serta jam pulang tercatat lengkap
  bool get isComplete {
    return (status == 'hadir' || status == 'terlambat') &&
        clockIn != null &&
        clockIn!.isNotEmpty &&
        clockOut != null &&
        clockOut!.isNotEmpty;
  }

  /// Hari hadir belum lengkap: sudah masuk hadir/terlambat namun belum jam pulang
  bool get isIncomplete {
    return (status == 'hadir' || status == 'terlambat') &&
        (clockIn == null || clockIn!.isEmpty || clockOut == null || clockOut!.isEmpty);
  }

  /// Status gaji untuk pelaporan
  String get salaryStatus {
    if (isComplete) return 'Dihitung';
    if (isIncomplete) return 'Belum Lengkap';
    return 'Tidak Dibayar'; // izin, sakit, alfa
  }
}
