import 'dart:typed_data';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/failure.dart';
import '../../core/jakarta_time.dart';
import '../models/attendance.dart';
import '../supabase_client.dart';

final attendanceRepositoryProvider = Provider<AttendanceRepository>((ref) {
  return AttendanceRepository(ref.watch(supabaseProvider));
});

class AttendanceRepository {
  final SupabaseClient _supabase;

  AttendanceRepository(this._supabase);

  /// Mengambil presensi hari ini untuk karyawan tertentu
  Future<Attendance?> getTodayAttendance(String employeeId) async {
    final todayStr = JakartaTime.formatIsoDate(JakartaTime.today());
    final res = await _supabase
        .from('company_attendance')
        .select('*, attendance_evidence(*)')
        .eq('employee_id', employeeId)
        .eq('attend_date', todayStr)
        .maybeSingle();

    if (res == null) return null;
    return Attendance.fromJson(res);
  }

  /// Mengambil riwayat presensi karyawan bulan berjalan (10 terbaru)
  Future<List<Attendance>> getRecentEmployeeAttendance(String employeeId, {int limit = 10}) async {
    final today = JakartaTime.today();
    final firstDayMonth = DateTime(today.year, today.month, 1);
    final firstDayStr = JakartaTime.formatIsoDate(firstDayMonth);

    final res = await _supabase
        .from('company_attendance')
        .select('*, attendance_evidence(*)')
        .eq('employee_id', employeeId)
        .gte('attend_date', firstDayStr)
        .order('attend_date', ascending: false)
        .limit(limit);

    return (res as List).map((row) => Attendance.fromJson(row)).toList();
  }

  /// Mengambil riwayat presensi karyawan berdasarkan rentang tanggal
  Future<List<Attendance>> getEmployeeHistory({
    required String employeeId,
    required DateTime startDate,
    required DateTime endDate,
  }) async {
    final startStr = JakartaTime.formatIsoDate(startDate);
    final endStr = JakartaTime.formatIsoDate(endDate);

    final res = await _supabase
        .from('company_attendance')
        .select('*, attendance_evidence(*)')
        .eq('employee_id', employeeId)
        .gte('attend_date', startStr)
        .lte('attend_date', endStr)
        .order('attend_date', ascending: false);

    return (res as List).map((row) => Attendance.fromJson(row)).toList();
  }

  /// Mengunggah foto bukti ke bucket attendance-photos
  Future<String> uploadAttendancePhoto({
    required String employeeId,
    required Uint8List photoBytes,
  }) async {
    final epoch = DateTime.now().millisecondsSinceEpoch;
    final path = '$employeeId/$epoch.jpg';

    try {
      await _supabase.storage.from('attendance-photos').uploadBinary(
            path,
            photoBytes,
            fileOptions: const FileOptions(
              contentType: 'image/jpeg',
              upsert: false,
            ),
          );
      return path;
    } catch (e) {
      throw Failure(
        code: 'UPLOAD_FAILED',
        message: 'Gagal mengunggah foto bukti: $e',
        nextStep: 'Periksa koneksi internet Anda dan coba lagi.',
      );
    }
  }

  /// Hapus foto dari storage (rollback best effort jika RPC gagal)
  Future<void> deletePhoto(String path) async {
    try {
      await _supabase.storage.from('attendance-photos').remove([path]);
    } catch (_) {}
  }

  /// Panggil RPC record_attendance_geo
  Future<Map<String, dynamic>> recordAttendanceGeo({
    required double lat,
    required double lng,
    required double accuracyM,
    required bool isMocked,
    required String photoPath,
  }) async {
    try {
      final res = await _supabase.rpc('record_attendance_geo', params: {
        'p_lat': lat,
        'p_lng': lng,
        'p_accuracy_m': accuracyM,
        'p_is_mocked': isMocked,
        'p_photo_path': photoPath,
      });

      if (res is Map<String, dynamic>) {
        return res;
      }
      return Map<String, dynamic>.from(res as Map);
    } catch (e) {
      throw Failure(
        code: 'RPC_FAILED',
        message: 'Gagal memproses presensi ke server: $e',
        nextStep: 'Silakan coba lagi.',
      );
    }
  }

  /// Merekam persetujuan penggunaan lokasi & kamera
  Future<void> acceptConsent() async {
    try {
      await _supabase.rpc('accept_attendance_consent');
    } catch (e) {
      throw Failure(
        code: 'CONSENT_FAILED',
        message: 'Gagal mencatat persetujuan: $e',
      );
    }
  }

  /// Mengambil data presensi hari ini untuk Admin Dashboard
  Future<List<Attendance>> getAdminTodayAttendance() async {
    final todayStr = JakartaTime.formatIsoDate(JakartaTime.today());
    final res = await _supabase
        .from('company_attendance')
        .select('*, employees(*), attendance_evidence(*)')
        .eq('attend_date', todayStr)
        .order('clock_in', ascending: false)
        .limit(10);

    return (res as List).map((row) => Attendance.fromJson(row)).toList();
  }

  /// Mengambil data rekap admin berdasarkan filter rentang tanggal dan departemen
  Future<List<Attendance>> getAdminRecapAttendance({
    required DateTime startDate,
    required DateTime endDate,
    String? department,
  }) async {
    final startStr = JakartaTime.formatIsoDate(startDate);
    final endStr = JakartaTime.formatIsoDate(endDate);

    var query = _supabase
        .from('company_attendance')
        .select('*, employees!inner(*), attendance_evidence(*)')
        .gte('attend_date', startStr)
        .lte('attend_date', endStr);

    if (department != null && department != 'Semua') {
      query = query.eq('employees.department', department);
    }

    final res = await query.order('attend_date', ascending: false);
    return (res as List).map((row) => Attendance.fromJson(row)).toList();
  }

  /// Input presensi manual oleh admin
  Future<void> recordManualAttendance({
    required String employeeId,
    required String status,
    required String date,
    String? clockIn,
    String? clockOut,
    String? note,
  }) async {
    // Validasi jam kerja untuk hadir & terlambat
    int lateMinutes = 0;
    if (status == 'hadir' || status == 'terlambat') {
      if (clockIn == null || clockIn.isEmpty) {
        throw const Failure(
          code: 'INVALID_INPUT',
          message: 'Jam masuk wajib diisi untuk status Hadir atau Terlambat.',
        );
      }
      if (clockOut == null || clockOut.isEmpty) {
        throw const Failure(
          code: 'INVALID_INPUT',
          message: 'Jam pulang wajib diisi untuk status Hadir atau Terlambat.',
        );
      }

      final inMin = JakartaTime.timeToMinutes(clockIn);
      final outMin = JakartaTime.timeToMinutes(clockOut);
      if (outMin < inMin) {
        throw const Failure(
          code: 'INVALID_HOURS',
          message: 'Jam pulang tidak boleh lebih awal dari jam masuk.',
        );
      }

      // Late minutes manual = max(0, jam masuk dikurangi jam masuk kantor)
      // Ambil jam masuk kantor dari settings
      final settingsRow = await _supabase.from('company_settings').select('work_start_time').eq('id', 1).maybeSingle();
      final officeStartStr = settingsRow?['work_start_time'] as String? ?? '08:00';
      final officeStartMin = JakartaTime.timeToMinutes(officeStartStr);
      if (inMin > officeStartMin) {
        lateMinutes = inMin - officeStartMin;
      }
    }

    try {
      await _supabase.from('company_attendance').insert({
        'employee_id': employeeId,
        'attend_date': date,
        'status': status,
        'clock_in': clockIn != null && clockIn.isNotEmpty ? clockIn : null,
        'clock_out': clockOut != null && clockOut.isNotEmpty ? clockOut : null,
        'late_minutes': lateMinutes,
        'note': note,
        'recorded_by': _supabase.auth.currentUser?.id,
      });
    } catch (e) {
      if (e.toString().contains('duplicate key') || e.toString().contains('unique')) {
        throw const Failure(
          code: 'DUPLICATE_ATTENDANCE',
          message: 'Karyawan sudah tercatat presensi pada tanggal tersebut.',
        );
      }
      throw Failure(
        code: 'SAVE_FAILED',
        message: 'Gagal menyimpan presensi manual: $e',
      );
    }
  }

  /// Menghasilkan signed URL berdurasi 60 detik untuk membuka foto bukti
  Future<String?> getSignedPhotoUrl(String photoPath) async {
    try {
      final res = await _supabase.storage
          .from('attendance-photos')
          .createSignedUrl(photoPath, 60);
      return res;
    } catch (_) {
      return null;
    }
  }
}
