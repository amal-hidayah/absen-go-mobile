import 'dart:async';
import 'package:flutter/material.dart';
import '../../../app/theme.dart';
import '../../../shared/widgets/status_badge.dart';

class AttendanceOverlay extends StatefulWidget {
  final Map<String, dynamic> result;
  final VoidCallback onClose;

  const AttendanceOverlay({
    super.key,
    required this.result,
    required this.onClose,
  });

  @override
  State<AttendanceOverlay> createState() => _AttendanceOverlayState();
}

class _AttendanceOverlayState extends State<AttendanceOverlay> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // Otomatis menutup sendiri setelah 4 detik
    _timer = Timer(const Duration(seconds: 4), () {
      if (mounted) {
        widget.onClose();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final aksi = (widget.result['aksi']?.toString() ?? 'presensi').toLowerCase();
    final jam = widget.result['jam']?.toString() ?? '-';
    final status = widget.result['status']?.toString() ?? 'hadir';
    final lateMin = (widget.result['late_minutes'] as num?)?.toInt();
    final dist = widget.result['distance_m'];

    return Container(
      color: Colors.black54,
      padding: const EdgeInsets.symmetric(horizontal: 24.0),
      child: Center(
        child: Card(
          elevation: 8,
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.statusHadirBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.check_circle_outline,
                    color: AppColors.statusHadirText,
                    size: 20,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Absen $aksi berhasil',
                  style: theme.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Tercatat pada pukul $jam WIB',
                  style: AppTheme.tabularFigures(
                    theme.textTheme.titleMedium!.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    StatusBadge(status: status, lateMinutes: lateMin),
                    if (dist != null) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.secondary,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '$dist m dari kantor',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSecondary,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: widget.onClose,
                  child: const Text('Tutup'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
