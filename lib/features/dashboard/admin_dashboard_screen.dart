import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../core/jakarta_time.dart';
import '../../core/strings.dart';
import '../../data/models/attendance.dart';
import '../../data/models/company_settings.dart';
import '../../data/repositories/attendance_repository.dart';
import '../../data/repositories/employee_repository.dart';
import '../../data/repositories/settings_repository.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/error_state.dart';
import '../../shared/widgets/loading_state.dart';
import '../../shared/widgets/page_header.dart';
import '../../shared/widgets/responsive_actions.dart';
import '../../shared/widgets/status_badge.dart';
import 'widgets/manual_attendance_sheet.dart';

final adminDashboardProvider = FutureProvider.autoDispose((ref) async {
  final attRepo = ref.watch(attendanceRepositoryProvider);
  final empRepo = ref.watch(employeeRepositoryProvider);
  final settingsRepo = ref.watch(settingsRepositoryProvider);

  final results = await Future.wait([
    empRepo.getEmployees(),
    attRepo.getAdminTodayAttendance(),
    settingsRepo.getPublicSettings(),
  ]);

  final allEmployees = results[0] as List<EmployeeWithAccount>;
  final todayAttendance = results[1] as List<Attendance>;
  final settings = results[2] as CompanySettings;

  final activeEmployees = allEmployees.where((e) => e.employee.active).toList();
  final activeCount = activeEmployees.length;

  int masukCount = 0;
  int terlambatCount = 0;
  int izinSakitAlfaCount = 0;

  for (final a in todayAttendance) {
    if (a.status == 'hadir') {
      masukCount++;
    } else if (a.status == 'terlambat') {
      masukCount++;
      terlambatCount++;
    } else if (a.status == 'izin' ||
        a.status == 'sakit' ||
        a.status == 'alfa') {
      izinSakitAlfaCount++;
    }
  }

  final recordedCount = todayAttendance.length;
  final belumPresensi = (activeCount - recordedCount) > 0
      ? (activeCount - recordedCount)
      : 0;

  return (
    settings: settings,
    activeCount: activeCount,
    masukCount: masukCount,
    terlambatCount: terlambatCount,
    izinSakitAlfaCount: izinSakitAlfaCount,
    belumPresensi: belumPresensi,
    todayAttendance: todayAttendance,
  );
});

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  void _openManualAttendanceSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => ManualAttendanceSheet(
        onSuccess: () {
          ref.invalidate(attendanceRepositoryProvider);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final dashboardAsync = ref.watch(adminDashboardProvider);

    return Scaffold(
      body: dashboardAsync.when(
        loading: () => const LoadingState(),
        error: (err, _) => ErrorState(
          message: 'Gagal memuat Dashboard: $err',
          onRetry: () => ref.invalidate(attendanceRepositoryProvider),
        ),
        data: (d) {
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(attendanceRepositoryProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(16.0),
              children: [
                PageHeader(
                  title: AppStrings.adminDashboard,
                  subtitle:
                      '${JakartaTime.formatFullDate(JakartaTime.today())} • ${d.settings.companyName}',
                ),
                ResponsiveActions(
                  children: [
                    FilledButton.tonalIcon(
                      style: FilledButton.styleFrom(
                        minimumSize: const Size(0, 48),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadius.button),
                        ),
                      ),
                      onPressed: () => _openManualAttendanceSheet(context, ref),
                      icon: const Icon(Icons.edit_calendar_outlined, size: 18),
                      label: const Text(AppStrings.manualAttendanceBtn),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // 1. Satu momen: ringkasan kehadiran hari ini
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.employeeCard,
                    borderRadius: BorderRadius.circular(AppRadius.card),
                  ),
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Presensi hari ini',
                            style: theme.textTheme.titleMedium?.copyWith(
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            d.settings.companyName,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: Colors.white.withValues(alpha: 0.72),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Text(
                        '${d.masukCount}',
                        style: AppTheme.tabularFigures(
                          theme.textTheme.headlineLarge!.copyWith(
                            fontSize: 44,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'dari ${d.activeCount} karyawan aktif sudah masuk',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.72),
                        ),
                      ),
                      const SizedBox(height: 16),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: Container(
                          height: 6,
                          color: Colors.white.withValues(alpha: 0.24),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: FractionallySizedBox(
                              widthFactor: d.activeCount == 0
                                  ? 0
                                  : (d.masukCount / d.activeCount).clamp(
                                      0.0,
                                      1.0,
                                    ),
                              child: Container(color: Colors.white),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Expanded(
                            child: _buildHeroStat(
                              label: 'Terlambat',
                              value: '${d.terlambatCount}',
                            ),
                          ),
                          Expanded(
                            child: _buildHeroStat(
                              label: 'Izin, sakit, alfa',
                              value: '${d.izinSakitAlfaCount}',
                            ),
                          ),
                          Expanded(
                            child: _buildHeroStat(
                              label: 'Belum presensi',
                              value: '${d.belumPresensi}',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // 3. DAFTAR PRESENSI KARYAWAN HARI INI
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        '${d.todayAttendance.length} dari ${d.activeCount} karyawan tercatat',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () => context.go('/admin/recap'),
                      child: const Text(AppStrings.seeRecap),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                if (d.todayAttendance.isEmpty)
                  const EmptyState(
                    title: 'Belum ada presensi hari ini',
                    description: AppStrings.emptyTodayAttendance,
                  )
                else
                  ...d.todayAttendance.map((att) {
                    final emp = att.employee;
                    final photoCount = att.evidences.length;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 20,
                              backgroundColor: theme.colorScheme.secondary,
                              child: Text(
                                emp?.fullName.isNotEmpty == true
                                    ? emp!.fullName[0].toUpperCase()
                                    : 'K',
                                style: TextStyle(
                                  fontWeight: FontWeight.w500,
                                  color: theme.colorScheme.primary,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    emp?.fullName ?? 'Karyawan',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w500,
                                      fontSize: 14,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${emp?.nik ?? "-"} · ${emp?.department ?? "-"}',
                                    style: theme.textTheme.bodySmall,
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          'Masuk ${JakartaTime.formatTimeString(att.clockIn)}',
                                          style: AppTheme.tabularFigures(
                                            theme.textTheme.bodySmall!.copyWith(
                                              color: theme
                                                  .colorScheme
                                                  .onSurfaceVariant,
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Text(
                                          'Pulang ${JakartaTime.formatTimeString(att.clockOut)}',
                                          style: AppTheme.tabularFigures(
                                            theme.textTheme.bodySmall!.copyWith(
                                              color: theme
                                                  .colorScheme
                                                  .onSurfaceVariant,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                StatusBadge(
                                  status: att.status,
                                  lateMinutes: att.lateMinutes,
                                ),
                                if (photoCount > 0) ...[
                                  const SizedBox(height: 4),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.photo_camera_outlined,
                                        size: 16,
                                        color:
                                            theme.colorScheme.onSurfaceVariant,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        '$photoCount bukti',
                                        style: theme.textTheme.bodySmall,
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildHeroStat({required String label, required String value}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: Colors.white.withValues(alpha: 0.72),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: AppTheme.tabularFigures(
            const TextStyle(fontSize: 18, color: Colors.white),
          ),
        ),
      ],
    );
  }
}
