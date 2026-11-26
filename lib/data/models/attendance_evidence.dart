class AttendanceEvidence {
  final String id;
  final String attendanceId;
  final String employeeId;
  final String kind; // 'masuk' | 'pulang'
  final double lat;
  final double lng;
  final double? accuracyM;
  final int distanceM;
  final bool isMocked;
  final String? photoPath;
  final DateTime capturedAt;

  const AttendanceEvidence({
    required this.id,
    required this.attendanceId,
    required this.employeeId,
    required this.kind,
    required this.lat,
    required this.lng,
    this.accuracyM,
    required this.distanceM,
    required this.isMocked,
    this.photoPath,
    required this.capturedAt,
  });

  factory AttendanceEvidence.fromJson(Map<String, dynamic> json) {
    return AttendanceEvidence(
      id: json['id'] as String,
      attendanceId: json['attendance_id'] as String,
      employeeId: json['employee_id'] as String,
      kind: json['kind'] as String? ?? 'masuk',
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      accuracyM: (json['accuracy_m'] as num?)?.toDouble(),
      distanceM: (json['distance_m'] as num?)?.toInt() ?? 0,
      isMocked: json['is_mocked'] as bool? ?? false,
      photoPath: json['photo_path'] as String?,
      capturedAt: DateTime.tryParse(json['captured_at'] as String? ?? '') ?? DateTime.now(),
    );
  }

  /// URL URI untuk membuka lokasi di Google Maps / aplikasi peta bawaan HP
  String get geoUri => 'geo:$lat,$lng?q=$lat,$lng';
}
