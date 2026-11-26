class Employee {
  final String id;
  final String? userId;
  final String nik;
  final String fullName;
  final String? email;
  final String department;
  final String position;
  final double dailySalary;
  final String role;
  final bool active;
  final DateTime? attendanceConsentAt;

  const Employee({
    required this.id,
    this.userId,
    required this.nik,
    required this.fullName,
    this.email,
    required this.department,
    required this.position,
    required this.dailySalary,
    required this.role,
    required this.active,
    this.attendanceConsentAt,
  });

  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      id: json['id'] as String,
      userId: json['user_id'] as String?,
      nik: json['nik'] as String? ?? '',
      fullName: json['full_name'] as String? ?? '',
      email: json['email'] as String?,
      department: json['department'] as String? ?? 'Operasional',
      position: json['position'] as String? ?? 'Staff',
      dailySalary: (json['daily_salary'] as num?)?.toDouble() ?? 0.0,
      role: json['role'] as String? ?? 'employee',
      active: json['active'] as bool? ?? true,
      attendanceConsentAt: json['attendance_consent_at'] != null
          ? DateTime.tryParse(json['attendance_consent_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'nik': nik,
      'full_name': fullName,
      'email': email,
      'department': department,
      'position': position,
      'daily_salary': dailySalary,
      'role': role,
      'active': active,
      if (attendanceConsentAt != null)
        'attendance_consent_at': attendanceConsentAt!.toIso8601String(),
    };
  }

  Employee copyWith({
    String? id,
    String? userId,
    String? nik,
    String? fullName,
    String? email,
    String? department,
    String? position,
    double? dailySalary,
    String? role,
    bool? active,
    DateTime? attendanceConsentAt,
  }) {
    return Employee(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      nik: nik ?? this.nik,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      department: department ?? this.department,
      position: position ?? this.position,
      dailySalary: dailySalary ?? this.dailySalary,
      role: role ?? this.role,
      active: active ?? this.active,
      attendanceConsentAt: attendanceConsentAt ?? this.attendanceConsentAt,
    );
  }
}
