import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/attendance/attendance_screen.dart';
import '../features/auth/account_blocked_screen.dart';
import '../features/auth/auth_controller.dart';
import '../features/auth/login_screen.dart';
import '../features/consent/consent_screen.dart';
import '../features/dashboard/admin_dashboard_screen.dart';
import '../features/dashboard/employee_dashboard_screen.dart';
import '../features/employees/employee_list_screen.dart';
import '../features/history/employee_history_screen.dart';
import '../features/payroll/payroll_screen.dart';
import '../features/recap/admin_recap_screen.dart';
import '../features/settings/settings_screen.dart';
import '../shared/widgets/app_shell.dart';

final routerNotifierProvider = Provider<RouterNotifier>((ref) {
  final notifier = RouterNotifier(ref);
  ref.onDispose(notifier.dispose);
  return notifier;
});

class RouterNotifier extends ChangeNotifier {
  final Ref _ref;

  RouterNotifier(this._ref) {
    _ref.listen<AuthState>(authControllerProvider, (_, _) {
      notifyListeners();
    });
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = ref.watch(routerNotifierProvider);
  final authState = ref.watch(authControllerProvider);

  return GoRouter(
    refreshListenable: notifier,
    initialLocation: '/login',
    redirect: (context, state) {
      final loc = state.matchedLocation;

      // 1. Splash / Initializing: belum selesai memulihkan sesi, biarkan di halaman saat ini
      if (!authState.isInitialized) {
        return null;
      }

      final isAuthenticated = authState.isAuthenticated;
      final isLoginRoute = loc == '/login';

      // 2. Jika belum login
      if (!isAuthenticated) {
        return isLoginRoute ? null : '/login';
      }

      // 3. Jika sudah login
      final profile = authState.profile;
      if (profile == null) {
        return isLoginRoute ? null : '/login';
      }

      final isAdmin = profile.isAdmin;
      final isEmployee = profile.isEmployee;

      // Karyawan
      if (isEmployee) {
        // Cek baris karyawan di database
        if (!profile.hasEmployeeProfile) {
          if (loc == '/no-profile') return null;
          return '/no-profile';
        }

        // Cek persetujuan privasi (attendance_consent_at)
        if (profile.employee?.attendanceConsentAt == null) {
          if (loc == '/consent') return null;
          return '/consent';
        }

        // Karyawan dilarang buka panel admin
        if (loc.startsWith('/admin')) {
          return '/admin-only';
        }

        // Jika berada di login, consent, no-profile, atau root -> arahkan ke Beranda
        if (isLoginRoute || loc == '/' || loc == '/no-profile' || loc == '/consent') {
          return '/employee/home';
        }
      }

      // Administrator
      if (isAdmin) {
        if (loc == '/admin-only' ||
            loc == '/no-profile' ||
            isLoginRoute ||
            loc == '/' ||
            loc.startsWith('/employee')) {
          return '/admin/dashboard';
        }
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/consent',
        builder: (context, state) => const ConsentScreen(),
      ),
      GoRoute(
        path: '/no-profile',
        builder: (context, state) => const NoProfileScreen(),
      ),
      GoRoute(
        path: '/admin-only',
        builder: (context, state) => const AdminOnlyScreen(),
      ),

      // StatefulShellRoute untuk Karyawan (3 Tab: Beranda, Absen, Riwayat)
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return AppShell(
            navigationShell: navigationShell,
            isAdmin: false,
          );
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/employee/home',
                builder: (context, state) => const EmployeeDashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/employee/attendance',
                builder: (context, state) => const AttendanceScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/employee/history',
                builder: (context, state) => const EmployeeHistoryScreen(),
              ),
            ],
          ),
        ],
      ),

      // StatefulShellRoute untuk Administrator (5 Tab: Beranda, Karyawan, Gaji, Rekap, Setelan)
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return AppShell(
            navigationShell: navigationShell,
            isAdmin: true,
          );
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/dashboard',
                builder: (context, state) => const AdminDashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/employees',
                builder: (context, state) => const EmployeeListScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/payroll',
                builder: (context, state) => const PayrollScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/recap',
                builder: (context, state) => const AdminRecapScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/admin/settings',
                builder: (context, state) => const SettingsScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
