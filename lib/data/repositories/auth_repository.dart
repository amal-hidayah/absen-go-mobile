import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/failure.dart';
import '../../core/strings.dart';
import '../models/employee.dart';
import '../models/login_account.dart';
import '../models/user_profile.dart';
import '../supabase_client.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(supabaseProvider));
});

class AuthRepository {
  final SupabaseClient _supabase;

  AuthRepository(this._supabase);

  User? get currentUser => _supabase.auth.currentUser;
  bool get isAuthenticated => currentUser != null;

  /// Login alur username & kata sandi sesuai spesifikasi Section 6
  Future<UserProfile> login({
    required String username,
    required String password,
  }) async {
    final cleanUsername = username.trim().toLowerCase();
    final cleanPassword = password.trim();

    // 1. Resolve email lewat RPC
    dynamic emailResult;
    try {
      emailResult = await _supabase.rpc(
        'resolve_login_email',
        params: {'_username': cleanUsername},
      );
    } catch (_) {
      throw const Failure(
        code: 'RESOLVE_ERROR',
        message: AppStrings.userNotFound,
      );
    }

    final resolvedEmail = emailResult?.toString();
    if (resolvedEmail == null || resolvedEmail.trim().isEmpty) {
      throw const Failure(
        code: 'USER_NOT_FOUND',
        message: AppStrings.userNotFound,
      );
    }

    // 2. Sign In dengan password
    AuthResponse authResponse;
    try {
      authResponse = await _supabase.auth.signInWithPassword(
        email: resolvedEmail.trim(),
        password: cleanPassword,
      );
    } catch (_) {
      throw const Failure(
        code: 'INVALID_CREDENTIALS',
        message: AppStrings.invalidCredentials,
      );
    }

    final user = authResponse.user;
    if (user == null) {
      throw const Failure(
        code: 'AUTH_FAILED',
        message: AppStrings.invalidCredentials,
      );
    }

    // 3. Baca profil dari login_accounts & employees
    return await _fetchProfileForUser(user);
  }

  /// Memulihkan profil sesi saat aplikasi dibuka ulang
  Future<UserProfile?> getCurrentUserProfile() async {
    final user = currentUser;
    if (user == null) return null;
    try {
      return await _fetchProfileForUser(user);
    } catch (_) {
      await signOut();
      return null;
    }
  }

  Future<UserProfile> _fetchProfileForUser(User user) async {
    // Baca login_accounts berdasarkan user_id
    final accRows = await _supabase
        .from('login_accounts')
        .select()
        .eq('user_id', user.id)
        .maybeSingle();

    if (accRows == null) {
      // Jika akun auth ada tapi baris login_accounts belum ada (misal akun admin baru dari Auth)
      // Cek apakah admin lewat RPC is_admin
      final isAdmin = await _checkIsAdmin();
      final account = LoginAccount(
        id: user.id,
        username: user.email?.split('@').first ?? 'admin',
        email: user.email ?? '',
        userId: user.id,
        role: isAdmin ? 'admin' : 'employee',
        employeeId: null,
        active: true,
      );
      return UserProfile(user: user, account: account, employee: null);
    }

    final account = LoginAccount.fromJson(accRows);

    if (!account.active) {
      await _supabase.auth.signOut();
      throw const Failure(
        code: 'ACCOUNT_INACTIVE',
        message: AppStrings.accountInactive,
      );
    }

    Employee? employee;
    if (account.employeeId != null) {
      final empRow = await _supabase
          .from('employees')
          .select()
          .eq('id', account.employeeId!)
          .maybeSingle();
      if (empRow != null) {
        employee = Employee.fromJson(empRow);
      }
    }

    return UserProfile(
      user: user,
      account: account,
      employee: employee,
    );
  }

  Future<bool> _checkIsAdmin() async {
    try {
      final res = await _supabase.rpc('is_admin');
      return res == true;
    } catch (_) {
      return false;
    }
  }

  Future<void> signOut() async {
    try {
      await _supabase.auth.signOut();
    } catch (_) {}
  }
}
