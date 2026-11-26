import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/theme.dart';
import '../../core/csv.dart';
import '../../core/jakarta_time.dart';
import '../../core/strings.dart';
import '../../data/models/attendance.dart';
import '../../data/repositories/attendance_repository.dart';
import '../../shared/widgets/data_list.dart';
import '../../shared/widgets/page_header.dart';
import '../../shared/widgets/responsive_actions.dart';
import '../../shared/widgets/status_badge.dart';
import '../auth/auth_controller.dart';

class EmployeeHistoryScreen extends ConsumerStatefulWidget {
  const EmployeeHistoryScreen({super.key});

  @override
  ConsumerState<EmployeeHistoryScreen> createState() =>
      _EmployeeHistoryScreenState();
}

class _EmployeeHistoryScreenState extends ConsumerState<EmployeeHistoryScreen> {
  late DateTime _startDate;
  late DateTime _endDate;
  bool _isLoading = false;
  String? _error;
  List<Attendance> _historyList = [];

  @override
  void initState() {
    super.initState();
    // Default 1 bulan berjalan
    final (start, end) = JakartaTime.presetOneMonth();
    _startDate = start;
    _endDate = end;
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final emp = ref.read(authControllerProvider).profile?.employee;
    if (emp == null) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final list = await ref
          .read(attendanceRepositoryProvider)
          .getEmployeeHistory(
            employeeId: emp.id,
            startDate: _startDate,
            endDate: _endDate,
          );
      if (mounted) {
        setState(() {
          _isLoading = false;
          _historyList = list;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = 'Gagal memuat riwayat: $e';
        });
      }
    }
  }

  Future<void> _exportCsv() async {
    final emp = ref.read(authControllerProvider).profile?.employee;
    if (emp == null || _historyList.isEmpty) return;

    final headers = [
      'Tanggal',
      'NIK',
      'Nama',
      'Departemen',
      'Jabatan',
      'Jam Masuk',
      'Jam Pulang',
      'Terlambat (Menit)',
      'Status',
      'Dihitung Gaji',
      'Keterangan',
    ];

    final rows = _historyList.map((a) {
      return [
        a.attendDate,
        emp.nik,
        emp.fullName,
        emp.department,
        emp.position,
        JakartaTime.formatTimeString(a.clockIn),
        JakartaTime.formatTimeString(a.clockOut),
        a.lateMinutes,
        a.status,
        a.isComplete ? 'Ya' : 'Belum',
        a.note ?? '',
      ];
    }).toList();

    final csvContent = CsvUtil.createCsvDocument(headers: headers, rows: rows);
    final tempDir = await getTemporaryDirectory();
    final startStr = JakartaTime.formatIsoDate(_startDate);
    final endStr = JakartaTime.formatIsoDate(_endDate);
    final fileName = 'rekap-presensi-karyawan-$startStr-sd-$endStr.csv';
    final file = File('${tempDir.path}/$fileName');
    await file.writeAsString(csvContent);

    // ignore: deprecated_member_use
    await Share.shareXFiles([
      XFile(file.path),
    ], text: 'Rekap Presensi Pribadi $startStr s/d $endStr');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final startStr = JakartaTime.formatShortDate(_startDate);
    final endStr = JakartaTime.formatShortDate(_endDate);

    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                PageHeader(
                  title: AppStrings.tabHistory,
                  subtitle: '$startStr s.d. $endStr',
                ),
                ResponsiveActions(
                  children: [
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 48),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadius.button),
                        ),
                      ),
                      icon: const Icon(Icons.share_outlined, size: 18),
                      label: const Text(AppStrings.exportCsv),
                      onPressed: _historyList.isEmpty ? null : _exportCsv,
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Filter Periode Tanggal
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: 16.0,
              vertical: 8.0,
            ),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.button),
                  ),
                ),
                onPressed: () async {
                  final picked = await showDateRangePicker(
                    context: context,
                    firstDate: DateTime(2024),
                    lastDate: DateTime(2030),
                    initialDateRange: DateTimeRange(
                      start: _startDate,
                      end: _endDate,
                    ),
                  );
                  if (picked != null) {
                    setState(() {
                      _startDate = picked.start;
                      _endDate = picked.end;
                    });
                    _loadHistory();
                  }
                },
                icon: const Icon(Icons.date_range, size: 18),
                label: Text(
                  '$startStr - $endStr',
                  style: const TextStyle(fontSize: 12),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ),
          const Divider(height: 1),

          // Daftar Riwayat
          Expanded(
            child: DataList<Attendance>(
              isLoading: _isLoading,
              error: _error,
              items: _historyList,
              onRefresh: _loadHistory,
              emptyTitle: 'Tidak Ada Riwayat',
              emptyDescription:
                  'Tidak ada catatan presensi pada rentang tanggal $startStr s/d $endStr.',
              itemBuilder: (context, item, index) {
                final dateObj =
                    JakartaTime.parseIsoDate(item.attendDate) ?? DateTime.now();
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              JakartaTime.formatFullDate(dateObj),
                              style: const TextStyle(
                                fontWeight: FontWeight.w500,
                                fontSize: 14,
                              ),
                            ),
                            StatusBadge(
                              status: item.status,
                              lateMinutes: item.lateMinutes,
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Masuk: ${JakartaTime.formatTimeString(item.clockIn)}',
                                style: AppTheme.tabularFigures(
                                  theme.textTheme.bodyMedium!,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                'Pulang: ${JakartaTime.formatTimeString(item.clockOut)}',
                                style: AppTheme.tabularFigures(
                                  theme.textTheme.bodyMedium!,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Gaji: ${item.salaryStatus}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: item.isComplete
                                    ? AppColors.statusHadirText
                                    : theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                            if (item.note != null && item.note!.isNotEmpty)
                              Text(
                                item.note!,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
