import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/failure.dart';
import '../models/company_settings.dart';
import '../supabase_client.dart';

final settingsRepositoryProvider = Provider<SettingsRepository>((ref) {
  return SettingsRepository(ref.watch(supabaseProvider));
});

class SettingsRepository {
  final SupabaseClient _supabase;

  SettingsRepository(this._supabase);

  /// Mengambil pengaturan publik kantor (bisa diakses karyawan dan admin)
  Future<CompanySettings> getPublicSettings() async {
    try {
      final res = await _supabase.rpc('get_public_settings');
      if (res is List && res.isNotEmpty) {
        return CompanySettings.fromJson(res.first as Map<String, dynamic>);
      }
      return const CompanySettings(
        id: 1,
        companyName: 'Belum diatur',
        workStartTime: '08:00',
        workEndTime: '17:00',
        lateToleranceMinutes: 15,
        officeRadiusM: 150,
        maxAccuracyM: 100,
      );
    } catch (_) {
      // Fallback baca langsung jika rpc gagal
      final row = await _supabase.from('company_settings').select().eq('id', 1).maybeSingle();
      if (row != null) {
        return CompanySettings.fromJson(row);
      }
      return const CompanySettings(
        id: 1,
        companyName: 'Belum diatur',
        workStartTime: '08:00',
        workEndTime: '17:00',
        lateToleranceMinutes: 15,
        officeRadiusM: 150,
        maxAccuracyM: 100,
      );
    }
  }

  /// Mengambil seluruh pengaturan kantor (khusus admin)
  Future<CompanySettings> getCompanySettings() async {
    final row = await _supabase.from('company_settings').select().eq('id', 1).maybeSingle();
    if (row == null) {
      throw const Failure(
        code: 'NOT_FOUND',
        message: 'Pengaturan kantor tidak ditemukan.',
      );
    }
    return CompanySettings.fromJson(row);
  }

  /// Memperbarui pengaturan kantor (khusus admin)
  Future<void> updateCompanySettings(CompanySettings settings) async {
    try {
      await _supabase.from('company_settings').update({
        'company_name': settings.companyName,
        'work_start_time': settings.workStartTime,
        'work_end_time': settings.workEndTime,
        'late_tolerance_minutes': settings.lateToleranceMinutes,
        'office_lat': settings.officeLat,
        'office_lng': settings.officeLng,
        'office_radius_m': settings.officeRadiusM,
        'max_accuracy_m': settings.maxAccuracyM,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', 1);
    } catch (e) {
      throw Failure(
        code: 'UPDATE_SETTINGS_FAILED',
        message: 'Gagal memperbarui pengaturan kantor: $e',
      );
    }
  }
}
