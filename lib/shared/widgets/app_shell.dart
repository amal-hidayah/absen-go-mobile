import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../app/theme.dart';
import '../../core/strings.dart';
import '../../data/models/company_settings.dart';
import '../../data/repositories/settings_repository.dart';
import '../../features/auth/auth_controller.dart';

final publicSettingsProvider = FutureProvider<CompanySettings>((ref) async {
  final repo = ref.watch(settingsRepositoryProvider);
  return repo.getPublicSettings();
});

class AppShell extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;
  final bool isAdmin;

  const AppShell({
    super.key,
    required this.navigationShell,
    required this.isAdmin,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final authState = ref.watch(authControllerProvider);
    final userProfile = authState.profile;
    final settingsAsync = ref.watch(publicSettingsProvider);

    final companyName = settingsAsync.when(
      data: (s) => s.companyName,
      loading: () => AppStrings.appName,
      error: (_, _) => AppStrings.appName,
    );

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              companyName,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              isAdmin ? AppStrings.adminDashboard : 'Portal Karyawan',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.65),
              ),
            ),
          ],
        ),
        actions: [
          _AccountMenuButton(userProfile: userProfile),
        ],
      ),
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) {
          navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
          );
        },
        destinations: isAdmin ? _adminDestinations : _employeeDestinations,
      ),
    );
  }

  static const List<NavigationDestination> _employeeDestinations = [
    NavigationDestination(
      icon: Icon(Icons.home_outlined),
      selectedIcon: Icon(Icons.home),
      label: AppStrings.tabHome,
    ),
    NavigationDestination(
      icon: Icon(Icons.camera_alt_outlined),
      selectedIcon: Icon(Icons.camera_alt_outlined),
      label: AppStrings.tabAttendance,
    ),
    NavigationDestination(
      icon: Icon(Icons.history_outlined),
      selectedIcon: Icon(Icons.history),
      label: AppStrings.tabHistory,
    ),
  ];

  static const List<NavigationDestination> _adminDestinations = [
    NavigationDestination(
      icon: Icon(Icons.dashboard_outlined),
      selectedIcon: Icon(Icons.dashboard),
      label: AppStrings.tabHome,
    ),
    NavigationDestination(
      icon: Icon(Icons.people_outline),
      selectedIcon: Icon(Icons.people),
      label: AppStrings.tabEmployees,
    ),
    NavigationDestination(
      icon: Icon(Icons.payments_outlined),
      selectedIcon: Icon(Icons.payments),
      label: AppStrings.tabPayroll,
    ),
    NavigationDestination(
      icon: Icon(Icons.summarize_outlined),
      selectedIcon: Icon(Icons.summarize),
      label: AppStrings.tabRecap,
    ),
    NavigationDestination(
      icon: Icon(Icons.settings_outlined),
      selectedIcon: Icon(Icons.settings),
      label: AppStrings.tabSettings,
    ),
  ];
}

class _AccountMenuButton extends ConsumerWidget {
  final dynamic userProfile;

  const _AccountMenuButton({required this.userProfile});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final String displayName = userProfile?.displayName ?? 'Pengguna';
    final String username = userProfile?.account.username ?? '-';
    final String role = userProfile?.account.role == 'admin' ? 'Administrator' : 'Karyawan';

    return PopupMenuButton<String>(
      tooltip: 'Menu Akun',
      offset: const Offset(0, 48),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      icon: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: theme.colorScheme.secondary,
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: Text(
          displayName.isNotEmpty ? displayName[0].toUpperCase() : 'U',
          style: TextStyle(
            fontWeight: FontWeight.w500,
            color: theme.colorScheme.onSecondary,
            fontSize: 16,
          ),
        ),
      ),
      onSelected: (value) async {
        if (value == 'logout') {
          final confirm = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('Konfirmasi Keluar'),
              content: const Text('Apakah Anda yakin ingin keluar dari akun ini?'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Batal'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  style: FilledButton.styleFrom(
                    backgroundColor: theme.colorScheme.error,
                  ),
                  child: const Text('Keluar'),
                ),
              ],
            ),
          );

          if (confirm == true) {
            await ref.read(authControllerProvider.notifier).logout();
          }
        }
      },
      itemBuilder: (context) => [
        PopupMenuItem<String>(
          enabled: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                displayName,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w500,
                  color: theme.colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '@$username • $role',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.65),
                ),
              ),
            ],
          ),
        ),
        const PopupMenuDivider(),
        PopupMenuItem<String>(
          value: 'logout',
          child: Row(
            children: [
              Icon(Icons.logout_outlined, size: 20, color: theme.colorScheme.error),
              const SizedBox(width: 12),
              Text(
                AppStrings.logout,
                style: TextStyle(
                  color: theme.colorScheme.error,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
