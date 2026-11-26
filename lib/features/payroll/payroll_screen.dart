import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/theme.dart';
import '../../core/currency.dart';
import '../../core/csv.dart';
import '../../core/jakarta_time.dart';
import '../../core/strings.dart';
import '../../data/repositories/payroll_repository.dart';
import '../../data/repositories/settings_repository.dart';
import '../../shared/widgets/data_list.dart';
import '../../shared/widgets/page_header.dart';
import '../../shared/widgets/responsive_actions.dart';
import 'payroll_slip_dialog.dart';

class PayrollScreen extends ConsumerStatefulWidget {
  const PayrollScreen({super.key});

  @override
  ConsumerState<PayrollScreen> createState() => _PayrollScreenState();
}

class _PayrollScreenState extends ConsumerState<PayrollScreen> {
  late DateTime _startDate;
  late DateTime _endDate;
  bool _isLoading = false;
  String? _error;
  PayrollOverallSummary? _summary;
  String _companyName = 'PT Sukses Mandiri';

  @override
  void initState() {
    super.initState();
    // Default 1 bulan berjalan
    final (start, end) = JakartaTime.presetOneMonth();
    _startDate = start;
    _endDate = end;
    _loadPayroll();
  }

  Future<void> _loadPayroll() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final payrollRepo = ref.read(payrollRepositoryProvider);
      final settings = await ref
          .read(settingsRepositoryProvider)
          .getPublicSettings();
      final summary = await payrollRepo.calculatePayroll(
        startDate: _startDate,
        endDate: _endDate,
      );

      if (mounted) {
        setState(() {
          _isLoading = false;
          _summary = summary;
          _companyName = settings.companyName;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = 'Gagal menghitung penggajian: $e';
        });
      }
    }
  }

  Future<void> _exportCsv() async {
    if (_summary == null || _summary!.employeeSummaries.isEmpty) return;

    final headers = [
      'NIK',
      'Nama',
      'Departemen',
      'Jabatan',
      'Tarif Gaji Harian',
      'Total Hari Hadir',
      'Tepat Waktu',
      'Terlambat',
      'Belum Lengkap (tidak dibayar)',
      'Izin/Sakit/Alfa',
      'Total Gaji Diterima',
    ];

    final rows = _summary!.employeeSummaries.map((s) {
      return [
        s.employee.nik,
        s.employee.fullName,
        s.employee.department,
        s.employee.position,
        s.employee.dailySalary.toInt(),
        s.daysPaid,
        s.onTimeCount,
        s.lateCount,
        s.incompleteCount,
        s.leaveCount,
        s.totalSalary.toInt(),
      ];
    }).toList();

    final csvContent = CsvUtil.createCsvDocument(headers: headers, rows: rows);
    final tempDir = await getTemporaryDirectory();
    final startStr = JakartaTime.formatIsoDate(_startDate);
    final endStr = JakartaTime.formatIsoDate(_endDate);
    final fileName = 'rekap-gaji-$startStr-sd-$endStr.csv';
    final file = File('${tempDir.path}/$fileName');
    await file.writeAsString(csvContent);

    // ignore: deprecated_member_use
    await Share.shareXFiles([
      XFile(file.path),
    ], text: 'Rekap Gaji Karyawan $startStr s/d $endStr');
  }

  void _showSlipDialog(PayrollEmployeeSummary item) {
    showDialog(
      context: context,
      builder: (ctx) => PayrollSlipDialog(
        companyName: _companyName,
        startDate: _startDate,
        endDate: _endDate,
        summary: item,
      ),
    );
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
                  title: AppStrings.tabPayroll,
                  subtitle:
                      'Gaji dihitung per hari hadir lengkap ($startStr s.d. $endStr)',
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
                      onPressed:
                          (_summary == null ||
                              _summary!.employeeSummaries.isEmpty)
                          ? null
                          : _exportCsv,
                    ),
                  ],
                ),
              ],
            ),
          ),
          // 1. Selector Periode (Preset 2 minggu, 1 bulan, custom)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                ActionChip(
                  materialTapTargetSize: MaterialTapTargetSize.padded,
                  label: const Text(
                    '2 Minggu Ini',
                    style: TextStyle(fontSize: 12),
                  ),
                  onPressed: () {
                    final (s, e) = JakartaTime.presetTwoWeeks();
                    setState(() {
                      _startDate = s;
                      _endDate = e;
                    });
                    _loadPayroll();
                  },
                ),
                ActionChip(
                  materialTapTargetSize: MaterialTapTargetSize.padded,
                  label: const Text(
                    '1 Bulan Penuh',
                    style: TextStyle(fontSize: 12),
                  ),
                  onPressed: () {
                    final (s, e) = JakartaTime.presetOneMonth();
                    setState(() {
                      _startDate = s;
                      _endDate = e;
                    });
                    _loadPayroll();
                  },
                ),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 260),
                  child: SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton(
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
                          _loadPayroll();
                        }
                      },
                      child: Text(
                        '$startStr - $endStr',
                        style: const TextStyle(fontSize: 12),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 2. Tiga Ringkasan
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: 16.0,
              vertical: 4.0,
            ),
            child: Row(
              children: [
                Expanded(
                  child: _buildMiniSummary(
                    context,
                    title: 'Total Pengeluaran',
                    value: _summary != null
                        ? CurrencyUtil.formatRupiah(_summary!.totalExpense)
                        : '-',
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildMiniSummary(
                    context,
                    title: 'Total Hari Masuk',
                    value: _summary != null
                        ? '${_summary!.totalDaysWorked} hari'
                        : '-',
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildMiniSummary(
                    context,
                    title: 'Karyawan Aktif',
                    value: _summary != null
                        ? '${_summary!.eligibleEmployeeCount} orang'
                        : '-',
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 16),

          // 3. Daftar Ringkasan Gaji Karyawan
          Expanded(
            child: DataList<PayrollEmployeeSummary>(
              isLoading: _isLoading,
              error: _error,
              items: _summary?.employeeSummaries ?? [],
              onRefresh: _loadPayroll,
              emptyTitle: 'Tidak Ada Data Gaji',
              emptyDescription:
                  'Tidak ada catatan kehadiran yang dihitung pada periode $startStr s/d $endStr.',
              itemBuilder: (context, item, index) {
                final emp = item.employee;
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
                                emp.fullName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w500,
                                  fontSize: 15,
                                ),
                              ),
                            ),
                            Text(
                              CurrencyUtil.formatRupiah(item.totalSalary),
                              style: AppTheme.tabularFigures(
                                const TextStyle(
                                  fontWeight: FontWeight.w500,
                                  fontSize: 16,
                                  color: AppColors.lightPrimary,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${emp.nik} · ${emp.department} - ${emp.position}',
                          style: theme.textTheme.bodySmall,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Tarif: ${CurrencyUtil.formatRupiah(emp.dailySalary)} · Hadir Lengkap: ${item.daysPaid} hari',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Tepat: ${item.onTimeCount} | Terlambat: ${item.lateCount} | Belum Lengkap: ${item.incompleteCount} | Izin/Sakit/Alfa: ${item.leaveCount}',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey.shade600,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton.icon(
                            onPressed: () => _showSlipDialog(item),
                            icon: const Icon(
                              Icons.receipt_long_outlined,
                              size: 16,
                            ),
                            label: const Text('Lihat Slip Gaji'),
                          ),
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

  Widget _buildMiniSummary(
    BuildContext context, {
    required String title,
    required String value,
  }) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall,
            ),
            const SizedBox(height: 4),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTheme.tabularFigures(
                theme.textTheme.titleMedium!.copyWith(
                  color: theme.colorScheme.onSurface,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
