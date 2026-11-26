import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/currency.dart';
import '../../core/strings.dart';
import '../../data/models/employee.dart';
import '../../data/repositories/employee_repository.dart';
import '../../shared/widgets/data_list.dart';
import '../../shared/widgets/page_header.dart';
import '../../shared/widgets/responsive_actions.dart';
import 'employee_form_sheet.dart';

class EmployeeListScreen extends ConsumerStatefulWidget {
  const EmployeeListScreen({super.key});

  @override
  ConsumerState<EmployeeListScreen> createState() => _EmployeeListScreenState();
}

class _EmployeeListScreenState extends ConsumerState<EmployeeListScreen> {
  final _searchController = TextEditingController();
  String _selectedDepartment = 'Semua';
  List<String> _departments = ['Semua'];
  List<EmployeeWithAccount> _employees = [];
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final repo = ref.read(employeeRepositoryProvider);
      final deps = await repo.getDepartments();
      final list = await repo.getEmployees(
        searchQuery: _searchController.text.trim().isNotEmpty
            ? _searchController.text.trim()
            : null,
        department: _selectedDepartment != 'Semua' ? _selectedDepartment : null,
      );

      if (mounted) {
        setState(() {
          _isLoading = false;
          _departments = deps;
          _employees = list;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = 'Gagal memuat data karyawan: $e';
        });
      }
    }
  }

  void _openAddSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) =>
          EmployeeAddSheet(totalCount: _employees.length, onSuccess: _loadData),
    );
  }

  void _openEditSheet(Employee emp) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => EmployeeEditSheet(employee: emp, onSuccess: _loadData),
    );
  }

  void _openChangePasswordDialog(EmployeeWithAccount item) {
    showDialog(
      context: context,
      builder: (ctx) => ChangePasswordDialog(
        employeeName: item.employee.fullName,
        employeeId: item.employee.id,
        onConfirm: (newPassword) async {
          await ref
              .read(employeeRepositoryProvider)
              .resetPassword(
                employeeId: item.employee.id,
                newPassword: newPassword,
              );
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Kata sandi berhasil diperbarui')),
            );
          }
        },
      ),
    );
  }

  void _confirmDelete(EmployeeWithAccount item) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Hapus ${item.employee.fullName}?'),
        content: const Text(
          'Tindakan ini akan menghapus akun login dan seluruh riwayat absensi karyawan ini secara permanen.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(AppStrings.cancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ref
                    .read(employeeRepositoryProvider)
                    .deleteEmployee(item.employee.id);
                _loadData();
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Gagal menghapus: $e')),
                  );
                }
              }
            },
            child: const Text(AppStrings.delete),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                PageHeader(
                  title: AppStrings.employeeListTitle,
                  subtitle: '${_employees.length} orang terdaftar',
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
                      onPressed: _openAddSheet,
                      icon: const Icon(
                        Icons.person_add_alt_1_outlined,
                        size: 18,
                      ),
                      label: const Text(AppStrings.addEmployee),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // 1. Search Bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Cari nama, NIK, jabatan, username...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          _loadData();
                        },
                      )
                    : null,
              ),
              onSubmitted: (_) => _loadData(),
            ),
          ),

          // 2. Filter Departemen
          SizedBox(
            height: 48,
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
          const Divider(height: 12),

          // 3. Daftar Karyawan
          Expanded(
            child: DataList<EmployeeWithAccount>(
              isLoading: _isLoading,
              error: _error,
              items: _employees,
              onRefresh: _loadData,
              emptyTitle: 'Tidak Ada Karyawan',
              emptyDescription: 'Tidak ditemukan data karyawan yang sesuai dengan pencarian atau filter.',
              emptyActionLabel: 'Tambah karyawan',
              onEmptyAction: _openAddSheet,
              itemBuilder: (context, item, index) {
                final emp = item.employee;
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CircleAvatar(
                              radius: 22,
                              backgroundColor: theme.colorScheme.secondary,
                              child: Text(
                                emp.fullName.isNotEmpty
                                    ? emp.fullName[0].toUpperCase()
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
                                    emp.fullName,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w500,
                                      fontSize: 15,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${emp.nik} · ${emp.department} - ${emp.position}',
                                    style: theme.textTheme.bodySmall,
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Tarif: ${CurrencyUtil.formatRupiah(emp.dailySalary)} / hari',
                                    style: AppTheme.tabularFigures(
                                      theme.textTheme.bodySmall!.copyWith(
                                        fontWeight: FontWeight.w500,
                                        color: theme.colorScheme.primary,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: item.account != null
                                        ? AppColors.statusSakitBg
                                        : theme.colorScheme.secondary,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    item.accountBadge,
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: item.account != null
                                          ? AppColors.statusSakitText
                                          : theme.colorScheme.onSurfaceVariant,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: emp.active
                                        ? AppColors.statusHadirBg
                                        : AppColors.statusAlfaBg,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    emp.active ? 'Aktif' : 'Nonaktif',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: emp.active
                                          ? AppColors.statusHadirText
                                          : AppColors.statusAlfaText,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const Divider(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            if (item.account != null) ...[
                              IconButton(
                                icon: const Icon(Icons.key_outlined, size: 20),
                                tooltip: 'Ganti Kata Sandi',
                                onPressed: () =>
                                    _openChangePasswordDialog(item),
                              ),
                            ],
                            IconButton(
                              icon: const Icon(Icons.edit_outlined, size: 20),
                              tooltip: 'Ubah Data',
                              onPressed: () => _openEditSheet(emp),
                            ),
                            IconButton(
                              icon: Icon(
                                Icons.delete_outline,
                                size: 20,
                                color: theme.colorScheme.error,
                              ),
                              tooltip: 'Hapus Karyawan',
                              onPressed: () => _confirmDelete(item),
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
