import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../core/currency.dart';
import '../../core/jakarta_time.dart';
import '../../core/strings.dart';
import '../../data/models/attendance.dart';
import '../../data/models/company_settings.dart';
import '../../data/repositories/attendance_repository.dart';
import '../../data/repositories/settings_repository.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/error_state.dart';
import '../../shared/widgets/loading_state.dart';
import '../../shared/widgets/page_header.dart';
import '../../shared/widgets/status_badge.dart';
import '../auth/auth_controller.dart';

final employeeDashboardProvider = FutureProvider.autoDispose((ref) async {
  final emp = ref.watch(authControllerProvider).profile?.employee;
  if (emp == null) return null;

  final attendanceRepo = ref.watch(attendanceRepositoryProvider);
  final settingsRepo = ref.watch(settingsRepositoryProvider);

  final results = await Future.wait([
    attendanceRepo.getTodayAttendance(emp.id),
    attendanceRepo.getRecentEmployeeAttendance(emp.id, limit: 10),
    settingsRepo.getPublicSettings(),
  ]);

  final todayAtt = results[0] as Attendance?;
  final recentAtt = results[1] as List<Attendance>;
  final settings = results[2] as CompanySettings;

  int daysWorked = 0;
  bool hasIncomplete = false;
  for (final r in recentAtt) {
    if (r.isComplete) {
      daysWorked++;
    } else if (r.isIncomplete) {
      hasIncomplete = true;
    }
  }

  final estimatedSalary = daysWorked * emp.dailySalary;

  return (
    today: todayAtt,
    recent: recentAtt,
    settings: settings,
    daysWorked: daysWorked,
    estimatedSalary: estimatedSalary,
    hasIncomplete: hasIncomplete,
  );
});

class EmployeeDashboardScreen extends ConsumerWidget {
  const EmployeeDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final emp = authState.profile?.employee;
    final theme = Theme.of(context);

    if (emp == null) {
      return const Scaffold(
        body: Center(child: Text('Data profil karyawan tidak ditemukan.')),
      );
    }

    final dashboardDataAsync = ref.watch(employeeDashboardProvider);

    return Scaffold(
      body: dashboardDataAsync.when(
        loading: () => const LoadingState(),
        error: (err, _) => ErrorState(
          message: 'Gagal memuat data Beranda: $err',
          onRetry: () => ref.invalidate(attendanceRepositoryProvider),
        ),
        data: (data) {
          if (data == null) return const LoadingState();
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(attendanceRepositoryProvider);
            },
            child: ListView(
              padding: const EdgeInsets.all(16.0),
              children: [
                PageHeader(
                  title: AppStrings.employeeDashboardTitle,
                  subtitle: JakartaTime.formatFullDate(JakartaTime.today()),
                ),
                // 1. Profil: permukaan netral, angka jadi informasi pendukung
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: theme.colorScheme.secondary,
                                borderRadius: BorderRadius.circular(
                                  AppRadius.chip,
                                ),
                              ),
                              child: Icon(
                                Icons.person_outline,
                                size: 20,
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    emp.fullName,
                                    style: theme.textTheme.titleLarge,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${emp.nik} · ${emp.department}',
                                    style: theme.textTheme.bodySmall,
                                  ),
                                  Text(
                                    '${emp.position} · ${CurrencyUtil.formatRupiah(emp.dailySalary)} / hari',
                                    style: theme.textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        const Divider(height: 1),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: _buildProfileStat(
                                context,
                                label: AppStrings.monthlyDaysPresent,
                                value: '${data.daysWorked} hari',
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: _buildProfileStat(
                                context,
                                label: AppStrings.estimatedSalary,
                                value: CurrencyUtil.formatRupiah(
                                  data.estimatedSalary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // 2. Satu momen berwarna: jam absensi hari ini
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
                            'Absensi hari ini',
                            style: theme.textTheme.titleMedium?.copyWith(
                              color: Colors.white,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.16),
                              borderRadius: BorderRadius.circular(
                                AppRadius.chip,
                              ),
                            ),
                            child: Text(
                              _todayStatusLabel(data.today),
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      Text(
                        'Jam masuk',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.72),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        JakartaTime.formatTimeString(data.today?.clockIn),
                        style: AppTheme.tabularFigures(
                          theme.textTheme.headlineLarge!.copyWith(
                            fontSize: 40,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      _buildAttendanceTimeline(
                        data.today?.clockIn,
                        data.today?.clockOut,
                      ),
                      if (data.hasIncomplete) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(AppRadius.chip),
                          ),
                          child: Text(
                            AppStrings.incompleteWarning,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                      if (data.today?.clockIn != null &&
                          data.today?.clockOut == null) ...[
                        const SizedBox(height: 12),
                        Text(
                          'Absen pulang dibuka pukul ${JakartaTime.formatTimeString(data.settings.workEndTime)} WIB',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: Colors.white.withValues(alpha: 0.72),
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppColors.employeeCard,
                        ),
                        onPressed: () {
                          if (emp.attendanceConsentAt == null) {
                            context.go('/consent');
                          } else {
                            context.go('/employee/attendance');
                          }
                        },
                        child: Text(
                          data.today?.clockIn == null
                              ? 'Absen masuk'
                              : 'Absen pulang',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // 3. DAFTAR RIWAYAT PRESENSI BULAN INI
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      AppStrings.recentHistory,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    TextButton(
                      onPressed: () => context.go('/employee/history'),
                      child: const Text('Semua Riwayat'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                if (data.recent.isEmpty)
                  const EmptyState(
                    title: 'Belum Ada Riwayat',
                    description: 'Riwayat presensi Anda untuk bulan ini akan tampil di sini.',
                  )
                else
                  ...data.recent.map((item) {
                    final dateObj =
                        JakartaTime.parseIsoDate(item.attendDate) ??
                        DateTime.now();
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  JakartaTime.formatShortDate(dateObj),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w500,
                                    fontSize: 14,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Masuk: ${JakartaTime.formatTimeString(item.clockIn)} · Pulang: ${JakartaTime.formatTimeString(item.clockOut)}',
                                  style: theme.textTheme.bodySmall,
                                ),
                              ],
                            ),
                            StatusBadge(
                              status: item.status,
                              lateMinutes: item.lateMinutes,
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

  Widget _buildProfileStat(
    BuildContext context, {
    required String label,
    required String value,
  }) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: theme.textTheme.bodySmall),
        const SizedBox(height: 4),
        Text(
          value,
          style: AppTheme.tabularFigures(
            theme.textTheme.titleLarge!.copyWith(
              color: theme.colorScheme.onSurface,
            ),
          ),
        ),
      ],
    );
  }

  String _todayStatusLabel(Attendance? att) {
    if (att == null) return 'Belum absen';
    final late = att.lateMinutes;
    if (late > 0 && att.status.toLowerCase() == 'hadir') {
      return 'Terlambat $late mnt';
    }
    return att.status[0].toUpperCase() + att.status.substring(1).toLowerCase();
  }

  Widget _buildAttendanceTimeline(String? clockIn, String? clockOut) {
    final hasIn = clockIn != null && clockIn.isNotEmpty && clockIn != '-';
    final hasOut = clockOut != null && clockOut.isNotEmpty && clockOut != '-';
    final lineColor = hasIn && hasOut
        ? Colors.white
        : Colors.white.withValues(alpha: 0.3);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: _buildTimePoint(
            label: 'Masuk',
            time: hasIn ? clockIn : '-',
            active: hasIn,
          ),
        ),
        Container(
          width: 64,
          height: 2,
          margin: const EdgeInsets.only(top: 3),
          color: lineColor,
        ),
        Expanded(
          child: _buildTimePoint(
            label: 'Pulang',
            time: hasOut ? clockOut : '-',
            active: hasOut,
          ),
        ),
      ],
    );
  }

  Widget _buildTimePoint({
    required String label,
    required String time,
    required bool active,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: active ? Colors.white : Colors.white.withValues(alpha: 0.4),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: Colors.white.withValues(alpha: 0.72),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          time,
          style: AppTheme.tabularFigures(
            const TextStyle(fontSize: 13, color: Colors.white),
          ),
        ),
      ],
    );
  }
}
