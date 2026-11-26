import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/theme.dart';
import '../../core/currency.dart';
import '../../core/strings.dart';
import '../../data/models/employee.dart';
import '../../data/repositories/employee_repository.dart';

class EmployeeAddSheet extends ConsumerStatefulWidget {
  final int totalCount;
  final VoidCallback onSuccess;

  const EmployeeAddSheet({
    super.key,
    required this.totalCount,
    required this.onSuccess,
  });

  @override
  ConsumerState<EmployeeAddSheet> createState() => _EmployeeAddSheetState();
}

class _EmployeeAddSheetState extends ConsumerState<EmployeeAddSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nikController;
  final _nameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _departmentController = TextEditingController(text: 'Operasional');
  final _positionController = TextEditingController(text: 'Staff');
  final _salaryController = TextEditingController(text: '100000');

  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Saran NIK EMP + nomor urut
    final nextNum = (widget.totalCount + 1).toString().padLeft(3, '0');
    _nikController = TextEditingController(text: 'EMP$nextNum');
  }

  @override
  void dispose() {
    _nikController.dispose();
    _nameController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _departmentController.dispose();
    _positionController.dispose();
    _salaryController.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final salary = CurrencyUtil.parseRupiah(_salaryController.text);

      await ref.read(employeeRepositoryProvider).createEmployee(
            nik: _nikController.text.trim().toUpperCase(),
            fullName: _nameController.text.trim(),
            username: _usernameController.text.trim().toLowerCase(),
            password: _passwordController.text.trim(),
            email: _emailController.text.trim().toLowerCase(),
            department: _departmentController.text.trim(),
            position: _positionController.text.trim(),
            dailySalary: salary,
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
                  const Text(
                    'Tambah karyawan baru',
                    style: TextStyle(fontWeight: FontWeight.w500, fontSize: 18),
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
                    color: AppColors.statusAlfaBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _error!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.statusAlfaText,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              TextFormField(
                controller: _nikController,
                decoration: const InputDecoration(labelText: 'NIK Karyawan'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'NIK wajib diisi' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Nama Lengkap'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Nama wajib diisi' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _usernameController,
                decoration: const InputDecoration(
                  labelText: 'Username Login',
                  hintText: 'Huruf kecil, angka, titik, strip (3-32 kar)',
                ),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Username wajib diisi';
                  if (!RegExp(r'^[a-z0-9._-]{3,32}$').hasMatch(v.trim())) {
                    return 'Pola username tidak valid (3-32 karakter)';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Alamat Email (Wajib)'),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Email wajib diisi';
                  if (!v.contains('@')) return 'Format email tidak valid';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Kata Sandi Akun (Min 6 Karakter)'),
                validator: (v) {
                  if (v == null || v.length < 6) return 'Kata sandi minimal 6 karakter';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _departmentController,
                      decoration: const InputDecoration(labelText: 'Departemen'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _positionController,
                      decoration: const InputDecoration(labelText: 'Jabatan'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _salaryController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Tarif Gaji Harian (Rp)',
                  hintText: '100000',
                ),
                validator: (v) {
                  final n = CurrencyUtil.parseRupiah(v ?? '');
                  if (n <= 0) return 'Tarif harian harus lebih dari 0';
                  return null;
                },
              ),
              const SizedBox(height: 20),

              FilledButton(
                onPressed: _isLoading ? null : _handleSave,
                child: _isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text(AppStrings.save),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}

class EmployeeEditSheet extends ConsumerStatefulWidget {
  final Employee employee;
  final VoidCallback onSuccess;

  const EmployeeEditSheet({
    super.key,
    required this.employee,
    required this.onSuccess,
  });

  @override
  ConsumerState<EmployeeEditSheet> createState() => _EmployeeEditSheetState();
}

class _EmployeeEditSheetState extends ConsumerState<EmployeeEditSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nikController;
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  late final TextEditingController _departmentController;
  late final TextEditingController _positionController;
  late final TextEditingController _salaryController;
  late bool _active;

  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.employee;
    _nikController = TextEditingController(text: e.nik);
    _nameController = TextEditingController(text: e.fullName);
    _emailController = TextEditingController(text: e.email ?? '');
    _departmentController = TextEditingController(text: e.department);
    _positionController = TextEditingController(text: e.position);
    _salaryController = TextEditingController(text: e.dailySalary.toInt().toString());
    _active = e.active;
  }

  @override
  void dispose() {
    _nikController.dispose();
    _nameController.dispose();
    _emailController.dispose();
    _departmentController.dispose();
    _positionController.dispose();
    _salaryController.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final salary = CurrencyUtil.parseRupiah(_salaryController.text);
      final updated = widget.employee.copyWith(
        nik: _nikController.text.trim().toUpperCase(),
        fullName: _nameController.text.trim(),
        email: _emailController.text.trim().isNotEmpty ? _emailController.text.trim() : null,
        department: _departmentController.text.trim(),
        position: _positionController.text.trim(),
        dailySalary: salary,
        active: _active,
      );

      await ref.read(employeeRepositoryProvider).updateEmployee(updated);

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
                  const Text(
                    'Ubah data karyawan',
                    style: TextStyle(fontWeight: FontWeight.w500, fontSize: 18),
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
                    color: AppColors.statusAlfaBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _error!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.statusAlfaText,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],

              TextFormField(
                controller: _nikController,
                decoration: const InputDecoration(labelText: 'NIK Karyawan'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'NIK wajib diisi' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: 'Nama Lengkap'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Nama wajib diisi' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _emailController,
                decoration: const InputDecoration(labelText: 'Email Karyawan'),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _departmentController,
                      decoration: const InputDecoration(labelText: 'Departemen'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _positionController,
                      decoration: const InputDecoration(labelText: 'Jabatan'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _salaryController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Tarif Gaji Harian (Rp)'),
              ),
              const SizedBox(height: 16),

              SwitchListTile(
                title: const Text('Status karyawan aktif'),
                subtitle: const Text('Menonaktifkan karyawan akan memblokir login akun.'),
                value: _active,
                onChanged: (val) {
                  setState(() => _active = val);
                },
                contentPadding: EdgeInsets.zero,
              ),
              const SizedBox(height: 20),

              FilledButton(
                onPressed: _isLoading ? null : _handleSave,
                child: _isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text(AppStrings.save),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}

class ChangePasswordDialog extends StatefulWidget {
  final String employeeName;
  final String employeeId;
  final Future<void> Function(String newPassword) onConfirm;

  const ChangePasswordDialog({
    super.key,
    required this.employeeName,
    required this.employeeId,
    required this.onConfirm,
  });

  @override
  State<ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<ChangePasswordDialog> {
  final _pwController = TextEditingController();
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _pwController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      title: Text('Ganti sandi: ${widget.employeeName}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_error != null) ...[
            Text(
              _error!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.statusAlfaText,
              ),
            ),
            const SizedBox(height: 12),
          ],
          TextField(
            controller: _pwController,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: 'Kata Sandi Baru (Min. 6 Karakter)',
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text(AppStrings.cancel),
        ),
        FilledButton(
          onPressed: _isLoading
              ? null
              : () async {
                  if (_pwController.text.length < 6) {
                    setState(() => _error = 'Kata sandi minimal 6 karakter.');
                    return;
                  }
                  setState(() {
                    _isLoading = true;
                    _error = null;
                  });
                  final nav = Navigator.of(context);
                  try {
                    await widget.onConfirm(_pwController.text.trim());
                    if (!mounted) return;
                    nav.pop();
                  } catch (e) {
                    setState(() {
                      _isLoading = false;
                      _error = e.toString().replaceFirst('Failure: ', '');
                    });
                  }
                },
          child: _isLoading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Text(AppStrings.save),
        ),
      ],
    );
  }
}
