import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../app/theme.dart';
import '../../core/strings.dart';
import 'auth_controller.dart';

class NoProfileScreen extends ConsumerWidget {
  const NoProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final theme = Theme.of(context);
    final username = authState.profile?.account.username ?? '-';

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.statusTerlambatBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.person_search_outlined,
                      size: 20,
                      color: AppColors.statusTerlambatText,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    AppStrings.noProfileTitle,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Akun "$username" belum terdaftar atau belum ditautkan dengan data profil karyawan kantor.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Silakan hubungi administrator kantor untuk mengaktifkan profil Anda.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 32),
                  FilledButton.icon(
                    onPressed: () {
                      ref.read(authControllerProvider.notifier).logout();
                    },
                    icon: const Icon(Icons.logout_outlined, size: 18),
                    label: const Text(AppStrings.logout),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class AdminOnlyScreen extends StatelessWidget {
  const AdminOnlyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.error.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    Icons.security_outlined,
                    size: 20,
                    color: theme.colorScheme.error,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  AppStrings.adminOnlyTitle,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineMedium,
                ),
                const SizedBox(height: 12),
                Text(
                  AppStrings.adminOnlyDesc,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: 28),
                FilledButton(
                  onPressed: () => context.go('/employee/dashboard'),
                  child: const Text(AppStrings.backToHome),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
