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
import '../../data/repositories/employee_repository.dart';
import '../../shared/widgets/data_list.dart';
import '../../shared/widgets/page_header.dart';
import '../../shared/widgets/responsive_actions.dart';
import '../../shared/widgets/status_badge.dart';
import 'evidence_detail_sheet.dart';

class AdminRecapScreen extends ConsumerStatefulWidget {
  const AdminRecapScreen({super.key});

  @override
  ConsumerState<AdminRecapScreen> createState() => _AdminRecapScreenState();
}

class _AdminRecapScreenState extends ConsumerState<AdminRecapScreen> {
  late DateTime _startDate;
  late DateTime _endDate;
  String _selectedDepartment = 'Semua';
  List<String> _departments = ['Semua'];
  List<Attendance> _attendanceList = [];
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Default hari ini
    final today = JakartaTime.today();
    _startDate = today;
    _endDate = today;
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final attRepo = ref.read(attendanceRepositoryProvider);
      final empRepo = ref.read(employeeRepositoryProvider);

      final deps = await empRepo.getDepartments();
      final list = await attRepo.getAdminRecapAttendance(
        startDate: _startDate,
        endDate: _endDate,
        department: _selectedDepartment != 'Semua' ? _selectedDepartment : null,
      );

      if (mounted) {
        setState(() {
          _isLoading = false;
          _departments = deps;
          _attendanceList = list;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = 'Gagal memuat data rekap: $e';
        });
      }
    }
  }

  Future<void> _exportCsv() async {
    if (_attendanceList.isEmpty) return;

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

    final rows = _attendanceList.map((a) {
      final emp = a.employee;
      return [
        a.attendDate,
        emp?.nik ?? '',
        emp?.fullName ?? '',
        emp?.department ?? '',
        emp?.position ?? '',
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
    ], text: 'Rekap Presensi Karyawan $startStr s/d $endStr');
  }

  void _showEvidence(Attendance att) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => EvidenceDetailSheet(attendance: att),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final startStr = JakartaTime.formatShortDate(_startDate);
    final endStr = JakartaTime.formatShortDate(_endDate);

    // Hitung ringkasan
    int hadirTepat = 0;
    int terlambat = 0;
    int izinSakitAlfa = 0;
    int belumLengkap = 0;

    for (final a in _attendanceList) {
      if (a.isComplete) {
        if (a.status == 'hadir') hadirTepat++;
        if (a.status == 'terlambat') terlambat++;
      } else if (a.isIncomplete) {
        belumLengkap++;
      } else {
        izinSakitAlfa++;
      }
    }

    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                PageHeader(
                  title: AppStrings.tabRecap,
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
                      onPressed: _attendanceList.isEmpty ? null : _exportCsv,
                    ),
                  ],
                ),
              ],
            ),
          ),
          // 1. Filter Tanggal & Departemen
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 6),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 260),
                  child: SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
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
                          _loadData();
                        }
                      },
                      icon: const Icon(Icons.calendar_today_outlined, size: 18),
                      label: Text(
                        '$startStr - $endStr',
                        style: const TextStyle(fontSize: 12),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ),
                ActionChip(
                  materialTapTargetSize: MaterialTapTargetSize.padded,
                  label: const Text('Hari Ini', style: TextStyle(fontSize: 12)),
                  onPressed: () {
                    final today = JakartaTime.today();
                    setState(() {
                      _startDate = today;
                      _endDate = today;
                    });
                    _loadData();
                  },
                ),
              ],
            ),
          ),

          // Departemen Filter Chips
          SizedBox(
            height: 44,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: _departments.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final dep = _departments[index];
                final isSelected = _selectedDepartment == dep;
                return ChoiceChip(
                  materialTapTargetSize: MaterialTapTargetSize.padded,
                  label: Text(dep),
                  selected: isSelected,
                  onSelected: (_) {
                    setState(() => _selectedDepartment = dep);
                    _loadData();
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // 2. Baris Ringkasan Ringkas
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest.withValues(
                  alpha: 0.4,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildSummaryItem(
                    context,
                    'Total',
                    '${_attendanceList.length}',
                  ),
                  _buildSummaryItem(context, 'Tepat', '$hadirTepat'),
                  _buildSummaryItem(context, 'Telat', '$terlambat'),
                  _buildSummaryItem(context, 'Izin, sakit', '$izinSakitAlfa'),
                  _buildSummaryItem(context, 'Belum lengkap', '$belumLengkap'),
                ],
              ),
            ),
          ),
          const Divider(height: 16),

          // 3. Daftar Kartu Rekap Presensi
          Expanded(
            child: DataList<Attendance>(
              isLoading: _isLoading,
              error: _error,
              items: _attendanceList,
              onRefresh: _loadData,
              emptyTitle: 'Tidak ada catatan presensi',
              emptyDescription:
                  'Tidak ditemukan catatan presensi pada rentang tanggal $startStr s/d $endStr.',
              itemBuilder: (context, item, index) {
                final emp = item.employee;
                final dateObj =
                    JakartaTime.parseIsoDate(item.attendDate) ?? DateTime.now();
                final hasEvidence = item.evidences.isNotEmpty;

                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                emp?.fullName ?? 'Karyawan',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w500,
                                  fontSize: 15,
                                ),
                              ),
                            ),
                            StatusBadge(
                              status: item.status,
                              lateMinutes: item.lateMinutes,
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${emp?.nik ?? "-"} · ${emp?.department ?? "-"} · ${JakartaTime.formatShortDate(dateObj)}',
                          style: theme.textTheme.bodySmall,
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
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: item.isComplete
                                    ? AppColors.statusHadirText
                                    : theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                            if (hasEvidence)
                              TextButton.icon(
                                onPressed: () => _showEvidence(item),
                                icon: const Icon(
                                  Icons.photo_library_outlined,
                                  size: 16,
                                ),
                                label: Text(
                                  '${item.evidences.length} Bukti Foto',
                                ),
                              )
                            else if (item.note != null && item.note!.isNotEmpty)
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

  Widget _buildSummaryItem(BuildContext context, String label, String value) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 2),
        Text(
          value,
          style: AppTheme.tabularFigures(
            TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
        ),
      ],
    );
  }
}
