class CompanySettings {
  final int id;
  final String companyName;
  final String workStartTime;
  final String workEndTime;
  final int lateToleranceMinutes;
  final double? officeLat;
  final double? officeLng;
  final int officeRadiusM;
  final int maxAccuracyM;

  const CompanySettings({
    required this.id,
    required this.companyName,
    required this.workStartTime,
    required this.workEndTime,
    required this.lateToleranceMinutes,
    this.officeLat,
    this.officeLng,
    required this.officeRadiusM,
    required this.maxAccuracyM,
  });

  factory CompanySettings.fromJson(Map<String, dynamic> json) {
    return CompanySettings(
      id: json['id'] as int? ?? 1,
      companyName: json['company_name'] as String? ?? 'PT Sukses Mandiri',
      workStartTime: json['work_start_time'] as String? ?? '08:00',
      workEndTime: json['work_end_time'] as String? ?? '17:00',
      lateToleranceMinutes: (json['late_tolerance_minutes'] as num?)?.toInt() ?? 15,
      officeLat: (json['office_lat'] as num?)?.toDouble(),
      officeLng: (json['office_lng'] as num?)?.toDouble(),
      officeRadiusM: (json['office_radius_m'] as num?)?.toInt() ?? 150,
      maxAccuracyM: (json['max_accuracy_m'] as num?)?.toInt() ?? 100,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'company_name': companyName,
      'work_start_time': workStartTime,
      'work_end_time': workEndTime,
      'late_tolerance_minutes': lateToleranceMinutes,
      'office_lat': officeLat,
      'office_lng': officeLng,
      'office_radius_m': officeRadiusM,
      'max_accuracy_m': maxAccuracyM,
    };
  }

  CompanySettings copyWith({
    int? id,
    String? companyName,
    String? workStartTime,
    String? workEndTime,
    int? lateToleranceMinutes,
    double? officeLat,
    double? officeLng,
    int? officeRadiusM,
    int? maxAccuracyM,
  }) {
    return CompanySettings(
      id: id ?? this.id,
      companyName: companyName ?? this.companyName,
      workStartTime: workStartTime ?? this.workStartTime,
      workEndTime: workEndTime ?? this.workEndTime,
      lateToleranceMinutes: lateToleranceMinutes ?? this.lateToleranceMinutes,
      officeLat: officeLat ?? this.officeLat,
      officeLng: officeLng ?? this.officeLng,
      officeRadiusM: officeRadiusM ?? this.officeRadiusM,
      maxAccuracyM: maxAccuracyM ?? this.maxAccuracyM,
    );
  }
}
