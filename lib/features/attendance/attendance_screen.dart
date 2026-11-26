import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:camera/camera.dart';

import '../../app/theme.dart';
import '../../core/strings.dart';
import '../../data/repositories/attendance_repository.dart';
import '../../shared/widgets/page_header.dart';
import '../auth/auth_controller.dart';
import 'attendance_controller.dart';
import 'widgets/attendance_overlay.dart';
import 'widgets/selfie_camera_screen.dart';

final todayAttendanceProvider = FutureProvider.autoDispose((ref) async {
  final emp = ref.watch(authControllerProvider).profile?.employee;
  if (emp == null) return null;
  return ref.watch(attendanceRepositoryProvider).getTodayAttendance(emp.id);
});

Future<void> _openSelfieCamera(BuildContext context, WidgetRef ref) async {
  final file = await Navigator.of(context).push<XFile>(
    MaterialPageRoute<XFile>(
      builder: (_) => const SelfieCameraScreen(),
      fullscreenDialog: true,
    ),
  );
  if (file == null) return;
  await ref.read(attendanceControllerProvider.notifier).attachSelfie(file);
}

class AttendanceScreen extends ConsumerWidget {
  const AttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(attendanceControllerProvider);
    final controller = ref.read(attendanceControllerProvider.notifier);
    final authState = ref.watch(authControllerProvider);
    final emp = authState.profile?.employee;
    final theme = Theme.of(context);
    final officeRadiusM = state.settings?.officeRadiusM ?? 150;
    final distanceM = state.distanceM ?? 0;
    final radiusProgress = officeRadiusM > 0
        ? (distanceM / officeRadiusM).clamp(0.0, 1.0)
        : 1.0;

    final todayAttendanceAsync = ref.watch(todayAttendanceProvider);

    return Scaffold(
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const PageHeader(
                  title: 'Presensi Kehadiran',
                  subtitle: 'Radius lokasi kantor & bukti foto selfie',
                ),
                // 1. KARTU IDENTITAS KARYAWAN & STATUS HARI INI
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 24,
                          backgroundColor: theme.colorScheme.primary.withValues(
                            alpha: 0.12,
                          ),
                          child: Icon(
                            Icons.person_outline,
                            color: theme.colorScheme.onSurfaceVariant,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                emp?.fullName ?? 'Karyawan',
                                style: theme.textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${emp?.nik ?? "-"} · ${emp?.department ?? "-"}',
                                style: theme.textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                        todayAttendanceAsync.when(
                          data: (att) {
                            String label = 'Belum masuk';
                            Color bg = theme.colorScheme.secondary;
                            Color fg = theme.colorScheme.onSurfaceVariant;

                            if (att != null) {
                              if (att.clockOut != null &&
                                  att.clockOut!.isNotEmpty) {
                                label = 'Sudah pulang';
                                bg = AppColors.statusSakitBg;
                                fg = AppColors.statusSakitText;
                              } else if (att.clockIn != null &&
                                  att.clockIn!.isNotEmpty) {
                                label = 'Sudah masuk';
                                bg = AppColors.statusHadirBg;
                                fg = AppColors.statusHadirText;
                              }
                            }

                            return Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: bg,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                label,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: fg,
                                ),
                              ),
                            );
                          },
                          loading: () => const SizedBox.shrink(),
                          error: (_, _) => const SizedBox.shrink(),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // 2. Satu momen: jarak ke kantor dan batas radiusnya
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
                            'Radius kantor',
                            style: theme.textTheme.titleMedium?.copyWith(
                              color: Colors.white,
                            ),
                          ),
                          _buildLocationChip(context, state.locationStatus),
                        ],
                      ),
                      const SizedBox(height: 24),

                      if (state.locationStatus == LocationStatus.checking) ...[
                        const LinearProgressIndicator(
                          color: Colors.white,
                          backgroundColor: Colors.white24,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Mencari titik koordinat GPS',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: Colors.white.withValues(alpha: 0.72),
                          ),
                        ),
                      ] else if (state.position != null) ...[
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              '${state.distanceM ?? "-"}',
                              style: AppTheme.tabularFigures(
                                theme.textTheme.headlineLarge!.copyWith(
                                  fontSize: 48,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'meter dari kantor',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: Colors.white.withValues(alpha: 0.72),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: Container(
                            height: 6,
                            color: Colors.white.withValues(alpha: 0.24),
                            child: Align(
                              alignment: Alignment.centerLeft,
                              child: FractionallySizedBox(
                                widthFactor: radiusProgress,
                                child: Container(color: Colors.white),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Batas radius $officeRadiusM m · akurasi ±${state.position?.accuracy.round() ?? "-"} m',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: Colors.white.withValues(alpha: 0.72),
                          ),
                        ),
                      ] else ...[
                        Text(
                          state.locationErrorMessage ??
                              'Titik GPS belum terdeteksi.',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: Colors.white,
                          ),
                        ),
                      ],

                      if (state.locationStatus == LocationStatus.outside) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(AppRadius.chip),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.warning_amber_outlined,
                                size: 18,
                                color: Colors.white,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  AppStrings.outsideWarning,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      const SizedBox(height: 12),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton.icon(
                          style: TextButton.styleFrom(
                            foregroundColor: Colors.white,
                          ),
                          onPressed:
                              state.locationStatus == LocationStatus.checking
                              ? null
                              : controller.fetchCurrentPosition,
                          icon: const Icon(
                            Icons.my_location_outlined,
                            size: 18,
                          ),
                          label: const Text(AppStrings.refreshLocation),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // 3. AREA SELFIE
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Bukti Selfie Kehadiran',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 12),

                        if (state.selfieFile != null) ...[
                          // Preview 3:4 ratio
                          ClipRRect(
                            borderRadius: BorderRadius.circular(16),
                            child: AspectRatio(
                              aspectRatio: 3 / 4,
                              child: Image.file(
                                File(state.selfieFile!.path),
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            onPressed: state.isSubmitting
                                ? null
                                : controller.submitAttendance,
                            icon: state.isSubmitting
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Icon(Icons.send_outlined, size: 18),
                            label: Text(
                              state.isSubmitting
                                  ? 'Mengirim...'
                                  : AppStrings.submitAttendance,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Center(
                            child: TextButton.icon(
                              onPressed: state.isSubmitting
                                  ? null
                                  : () => _openSelfieCamera(context, ref),
                              icon: const Icon(Icons.replay_outlined, size: 18),
                              label: const Text(AppStrings.retakeSelfie),
                            ),
                          ),
                        ] else ...[
                          InkWell(
                            onTap: state.isSubmitting
                                ? null
                                : () => _openSelfieCamera(context, ref),
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              height: 180,
                              decoration: BoxDecoration(
                                color: theme.colorScheme.surfaceContainerHighest
                                    .withValues(alpha: 0.3),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: theme.colorScheme.outline.withValues(
                                    alpha: 0.5,
                                  ),
                                  style: BorderStyle.solid,
                                ),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  CircleAvatar(
                                    radius: 28,
                                    backgroundColor: theme.colorScheme.primary,
                                    child: const Icon(
                                      Icons.camera_alt_outlined,
                                      color: Colors.white,
                                      size: 24,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    AppStrings.takeSelfie,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w500,
                                      color: theme.colorScheme.primary,
                                      fontSize: 15,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Kamera depan akan otomatis terbuka',
                                    style: theme.textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],

                        const SizedBox(height: 12),
                        Text(
                          AppStrings.selfieHelpText,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Error Banner jika pengiriman gagal
                if (state.failure != null) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.error.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: theme.colorScheme.error.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.error_outline,
                          color: theme.colorScheme.error,
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                state.failure!.message,
                                style: TextStyle(
                                  color: theme.colorScheme.error,
                                  fontWeight: FontWeight.w500,
                                  fontSize: 13,
                                ),
                              ),
                              if (state.failure!.nextStep != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  state.failure!.nextStep!,
                                  style: TextStyle(
                                    color: theme.colorScheme.error,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ],
            ),
          ),

          // 4. OVERLAY KONFIRMASI SUKSES
          if (state.successResult != null)
            AttendanceOverlay(
              result: state.successResult!,
              onClose: () {
                controller.clearResult();
                // Refresh data hari ini
                ref.invalidate(attendanceRepositoryProvider);
              },
            ),
        ],
      ),
    );
  }

  Widget _buildLocationChip(BuildContext context, LocationStatus status) {
    final theme = Theme.of(context);
    final label = switch (status) {
      LocationStatus.inside => AppStrings.insideRadius,
      LocationStatus.outside => AppStrings.outsideRadius,
      LocationStatus.lowAccuracy => AppStrings.lowAccuracy,
      LocationStatus.disabled => 'GPS nonaktif',
      LocationStatus.permissionDenied => 'Izin ditolak',
      LocationStatus.checking => 'Mengecek',
      _ => 'Belum ada lokasi',
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(AppRadius.chip),
      ),
      child: Text(
        label,
        style: theme.textTheme.bodySmall?.copyWith(color: Colors.white),
      ),
    );
  }
}
