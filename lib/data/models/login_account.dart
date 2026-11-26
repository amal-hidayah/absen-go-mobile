class LoginAccount {
  final String id;
  final String username;
  final String email;
  final String? userId;
  final String role; // 'admin' | 'employee'
  final String? employeeId;
  final bool active;

  const LoginAccount({
    required this.id,
    required this.username,
    required this.email,
    this.userId,
    required this.role,
    this.employeeId,
    required this.active,
  });

  factory LoginAccount.fromJson(Map<String, dynamic> json) {
    return LoginAccount(
      id: json['id'] as String,
      username: json['username'] as String? ?? '',
      email: json['email'] as String? ?? '',
      userId: json['user_id'] as String?,
      role: json['role'] as String? ?? 'employee',
      employeeId: json['employee_id'] as String?,
      active: json['active'] as bool? ?? true,
    );
  }

  bool get isAdmin => role == 'admin';
}
