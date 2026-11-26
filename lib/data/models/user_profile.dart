import 'package:supabase_flutter/supabase_flutter.dart';
import 'employee.dart';
import 'login_account.dart';

class UserProfile {
  final User user;
  final LoginAccount account;
  final Employee? employee;

  const UserProfile({
    required this.user,
    required this.account,
    this.employee,
  });

  bool get isAdmin => account.role == 'admin';
  bool get isEmployee => account.role == 'employee';
  bool get hasEmployeeProfile => employee != null;
  String get displayName => employee?.fullName ?? account.username;

  UserProfile copyWith({
    User? user,
    LoginAccount? account,
    Employee? employee,
  }) {
    return UserProfile(
      user: user ?? this.user,
      account: account ?? this.account,
      employee: employee ?? this.employee,
    );
  }
}
