import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/failure.dart';
import '../models/employee.dart';
import '../models/login_account.dart';
import '../supabase_client.dart';

class EmployeeWithAccount {
  final Employee employee;
  final LoginAccount? account;

  const EmployeeWithAccount({
    required this.employee,
    this.account,
  });

  String get accountBadge {
    if (account == null) return 'Belum ada akun';
    return account!.isAdmin ? 'Admin' : 'Karyawan';
  }
}

final employeeRepositoryProvider = Provider<EmployeeRepository>((ref) {
  return EmployeeRepository(ref.watch(supabaseProvider));
});

class EmployeeRepository {
  final SupabaseClient _supabase;

  EmployeeRepository(this._supabase);

  /// Mengambil daftar semua karyawan beserta status akun loginnya
  Future<List<EmployeeWithAccount>> getEmployees({
    String? searchQuery,
    String? department,
  }) async {
    var query = _supabase
        .from('employees')
        .select('*, login_accounts(*)');

    if (department != null && department != 'Semua') {
      query = query.eq('department', department);
    }

    final res = await query.order('created_at', ascending: false);

    final list = <EmployeeWithAccount>[];
    for (final row in (res as List)) {
      final emp = Employee.fromJson(row);
      LoginAccount? acc;
      if (row['login_accounts'] != null && row['login_accounts'] is List && (row['login_accounts'] as List).isNotEmpty) {
        acc = LoginAccount.fromJson((row['login_accounts'] as List).first as Map<String, dynamic>);
      }

      if (searchQuery != null && searchQuery.trim().isNotEmpty) {
        final q = searchQuery.toLowerCase();
        final matchesName = emp.fullName.toLowerCase().contains(q);
        final matchesNik = emp.nik.toLowerCase().contains(q);
        final matchesPos = emp.position.toLowerCase().contains(q);
        final matchesUsername = acc?.username.toLowerCase().contains(q) ?? false;
        if (!matchesName && !matchesNik && !matchesPos && !matchesUsername) {
          continue;
        }
      }

      list.add(EmployeeWithAccount(employee: emp, account: acc));
    }

    return list;
  }

  /// Membuat karyawan baru beserta akun login Supabase Auth lewat Edge Function
  Future<void> createEmployee({
    required String nik,
    required String fullName,
    required String username,
    required String password,
    required String email,
    required String department,
    required String position,
    required double dailySalary,
  }) async {
    try {
      final res = await _supabase.functions.invoke(
        'manage-employee-account',
        body: {
          'action': 'create',
          'nik': nik,
          'full_name': fullName,
          'username': username,
          'password': password,
          'email': email,
          'department': department,
          'position': position,
          'daily_salary': dailySalary,
        },
      );

      final data = res.data;
      if (res.status != 200 || (data is Map && data['error'] != null)) {
        throw Failure(
          code: 'CREATE_FAILED',
          message: data is Map ? data['error'].toString() : 'Gagal membuat akun karyawan.',
        );
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw Failure(
        code: 'CREATE_FAILED',
        message: 'Gagal membuat karyawan: $e',
      );
    }
  }

  /// Mengubah data karyawan (nama, departemen, jabatan, tarif gaji, status aktif)
  Future<void> updateEmployee(Employee employee) async {
    try {
      await _supabase.from('employees').update({
        'nik': employee.nik,
        'full_name': employee.fullName,
        'email': employee.email,
        'department': employee.department,
        'position': employee.position,
        'daily_salary': employee.dailySalary,
        'active': employee.active,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', employee.id);

      // Sinkronkan status aktif ke login_accounts lewat Edge Function
      await _supabase.functions.invoke(
        'manage-employee-account',
        body: {
          'action': 'set_active',
          'employee_id': employee.id,
          'active': employee.active,
        },
      );
    } catch (e) {
      throw Failure(
        code: 'UPDATE_FAILED',
        message: 'Gagal memperbarui data karyawan: $e',
      );
    }
  }

  /// Reset kata sandi karyawan lewat Edge Function
  Future<void> resetPassword({
    required String employeeId,
    required String newPassword,
  }) async {
    try {
      final res = await _supabase.functions.invoke(
        'manage-employee-account',
        body: {
          'action': 'reset_password',
          'employee_id': employeeId,
          'password': newPassword,
        },
      );
      final data = res.data;
      if (res.status != 200 || (data is Map && data['error'] != null)) {
        throw Failure(
          code: 'RESET_FAILED',
          message: data is Map ? data['error'].toString() : 'Gagal mengganti kata sandi.',
        );
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw Failure(
        code: 'RESET_FAILED',
        message: 'Gagal mereset kata sandi: $e',
      );
    }
  }

  /// Hapus akun login dan data karyawan lewat Edge Function
  Future<void> deleteEmployee(String employeeId) async {
    try {
      final res = await _supabase.functions.invoke(
        'manage-employee-account',
        body: {
          'action': 'delete',
          'employee_id': employeeId,
        },
      );
      final data = res.data;
      if (res.status != 200 || (data is Map && data['error'] != null)) {
        throw Failure(
          code: 'DELETE_FAILED',
          message: data is Map ? data['error'].toString() : 'Gagal menghapus karyawan.',
        );
      }
    } catch (e) {
      if (e is Failure) rethrow;
      throw Failure(
        code: 'DELETE_FAILED',
        message: 'Gagal menghapus karyawan: $e',
      );
    }
  }

  /// Mengambil daftar departemen unik
  Future<List<String>> getDepartments() async {
    try {
      final res = await _supabase.from('employees').select('department');
      final deps = (res as List)
          .map((row) => row['department']?.toString() ?? '')
          .where((d) => d.isNotEmpty)
          .toSet()
          .toList();
      deps.sort();
      return ['Semua', ...deps];
    } catch (_) {
      return ['Semua', 'Operasional', 'IT Support', 'Keuangan', 'Pemasaran', 'HRD'];
    }
  }
}
