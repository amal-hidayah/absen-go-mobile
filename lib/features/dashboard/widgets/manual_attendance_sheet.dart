import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/jakarta_time.dart';
import '../../../core/strings.dart';
import '../../../data/repositories/attendance_repository.dart';
import '../../../data/repositories/employee_repository.dart';
import '../../../data/repositories/settings_repository.dart';

final manualAttendanceEmployeesProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(employeeRepositoryProvider).getEmployees(),
);

final manualAttendanceSettingsProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(settingsRepositoryProvider).getPublicSettings(),
);

class ManualAttendanceSheet extends ConsumerStatefulWidget {
  final VoidCallback onSuccess;

  const ManualAttendanceSheet({super.key, required this.onSuccess});

  @override
  ConsumerState<ManualAttendanceSheet> createState() =>
      _ManualAttendanceSheetState();
}

class _ManualAttendanceSheetState extends ConsumerState<ManualAttendanceSheet> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedEmployeeId;
  String _selectedStatus = 'sakit'; // Default sakit
  final _dateController = TextEditingController(
    text: JakartaTime.formatIsoDate(JakartaTime.today()),
  );
  final _clockInController = TextEditingController(text: '08:00');
  final _clockOutController = TextEditingController(text: '17:00');
  final _noteController = TextEditingController();

  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _dateController.dispose();
    _clockInController.dispose();
    _clockOutController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedEmployeeId == null) {
      setState(() => _error = 'Pilih karyawan terlebih dahulu.');
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final isHadirAtauTerlambat =
          _selectedStatus == 'hadir' || _selectedStatus == 'terlambat';

      await ref
          .read(attendanceRepositoryProvider)
          .recordManualAttendance(
            employeeId: _selectedEmployeeId!,
            status: _selectedStatus,
            date: _dateController.text,
            clockIn: isHadirAtauTerlambat ? _clockInController.text : null,
            clockOut: isHadirAtauTerlambat ? _clockOutController.text : null,
            note: _noteController.text.trim().isNotEmpty
                ? _noteController.text.trim()
                : null,
          );

      if (mounted) {
        Navigator.pop(context);
        widget.onSuccess();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = e.toString().replaceFirst('Failure: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final employeesAsync = ref.watch(manualAttendanceEmployeesProvider);
    final settingsAsync = ref.watch(manualAttendanceSettingsProvider);

    final isHadirAtauTerlambat =
        _selectedStatus == 'hadir' || _selectedStatus == 'terlambat';

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Input Presensi Manual',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const Divider(),
              const SizedBox(height: 12),

              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.error.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: theme.colorScheme.error,
                      fontSize: 13,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // 1. Pilih Karyawan
              employeesAsync.when(
                data: (list) {
                  final activeList = list
                      .where((e) => e.employee.active)
                      .toList();
                  return DropdownButtonFormField<String>(
                    initialValue: _selectedEmployeeId,
                    decoration: const InputDecoration(
                      labelText: 'Pilih Karyawan',
                    ),
                    items: activeList.map((item) {
                      return DropdownMenuItem(
                        value: item.employee.id,
                        child: Text(
                          '${item.employee.fullName} (${item.employee.nik})',
                        ),
                      );
                    }).toList(),
                    onChanged: (val) {
                      setState(() => _selectedEmployeeId = val);
                    },
                    validator: (v) => v == null ? 'Pilih karyawan' : null,
                  );
                },
                loading: () => const LinearProgressIndicator(),
                error: (e, _) => Text('Gagal memuat karyawan: $e'),
              ),
              const SizedBox(height: 16),

              // 2. Pilih Status
              DropdownButtonFormField<String>(
                initialValue: _selectedStatus,
                decoration: const InputDecoration(
                  labelText: 'Status Kehadiran',
                ),
                items: const [
                  DropdownMenuItem(value: 'sakit', child: Text('Sakit')),
                  DropdownMenuItem(value: 'izin', child: Text('Izin')),
                  DropdownMenuItem(value: 'alfa', child: Text('Alfa')),
                  DropdownMenuItem(value: 'hadir', child: Text('Hadir')),
                  DropdownMenuItem(
                    value: 'terlambat',
                    child: Text('Terlambat'),
                  ),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _selectedStatus = val);
                },
              ),
              const SizedBox(height: 16),

              // 3. Tanggal
              TextFormField(
                controller: _dateController,
                decoration: const InputDecoration(
                  labelText: 'Tanggal Presensi (YYYY-MM-DD)',
                  suffixIcon: Icon(Icons.calendar_today_outlined),
                ),
                onTap: () async {
                  FocusScope.of(context).requestFocus(FocusNode());
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: JakartaTime.today(),
                    firstDate: DateTime(2024),
                    lastDate: DateTime(2030),
                  );
                  if (picked != null) {
                    _dateController.text = JakartaTime.formatIsoDate(picked);
                  }
                },
              ),
              const SizedBox(height: 16),

              // 4. Jam Masuk & Jam Pulang (Hanya untuk hadir / terlambat)
              if (isHadirAtauTerlambat) ...[
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _clockInController,
                        decoration: const InputDecoration(
                          labelText: 'Jam Masuk (HH:mm)',
                          hintText: '08:00',
                        ),
                        validator: (v) =>
                            (v == null || v.isEmpty) ? 'Wajib diisi' : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _clockOutController,
                        decoration: const InputDecoration(
                          labelText: 'Jam Pulang (HH:mm)',
                          hintText: '17:00',
                        ),
                        validator: (v) =>
                            (v == null || v.isEmpty) ? 'Wajib diisi' : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                settingsAsync.when(
                  data: (s) => Text(
                    'Jam kantor ${s.workStartTime}–${s.workEndTime} WIB',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, _) => const SizedBox.shrink(),
                ),
                const SizedBox(height: 16),
              ],

              // 5. Keterangan
              TextFormField(
                controller: _noteController,
                decoration: const InputDecoration(
                  labelText: 'Keterangan Tambahan (Opsional)',
                  hintText:
                      'Contoh: Izin acara keluarga, Surat dokter terlampir',
                ),
                maxLines: 2,
              ),
              const SizedBox(height: 20),

              // Tombol Batal & Simpan: aksi utama penuh lebar, pembatal di bawahnya
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  FilledButton(
                    onPressed: _isLoading ? null : _handleSave,
                    child: _isLoading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(AppStrings.save),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text(AppStrings.cancel),
                  ),
                ],
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}
