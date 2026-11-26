import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/strings.dart';
import '../../data/repositories/attendance_repository.dart';
import '../auth/auth_controller.dart';

class ConsentScreen extends ConsumerStatefulWidget {
  const ConsentScreen({super.key});

  @override
  ConsumerState<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends ConsumerState<ConsentScreen> {
  bool _isLoading = false;
  String? _error;

  Future<void> _handleAccept() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await ref.read(attendanceRepositoryProvider).acceptConsent();
      // Perbarui state profil lokal
      final authState = ref.read(authControllerProvider);
      if (authState.profile?.employee != null) {
        final updatedEmp = authState.profile!.employee!.copyWith(
          attendanceConsentAt: DateTime.now(),
        );
        final updatedProfile = authState.profile!.copyWith(employee: updatedEmp);
        ref.read(authControllerProvider.notifier).updateProfile(updatedProfile);
      }
      if (mounted) {
        context.go('/employee/attendance');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = 'Gagal menyimpan persetujuan: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.consentTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_outlined),
            tooltip: AppStrings.logout,
            onPressed: () {
              ref.read(authControllerProvider.notifier).logout();
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor: theme.colorScheme.secondary,
                            child: Icon(Icons.shield_outlined, color: theme.colorScheme.primary),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              AppStrings.consentSubtitle,
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      _buildBulletItem(
                        context,
                        icon: Icons.my_location_outlined,
                        title: 'Data yang Dikumpulkan',
                        desc: AppStrings.consentDataCollected,
                      ),
                      const SizedBox(height: 16),
                      _buildBulletItem(
                        context,
                        icon: Icons.fact_check_outlined,
                        title: 'Tujuan Penggunaan',
                        desc: AppStrings.consentPurpose,
                      ),
                      const SizedBox(height: 16),
                      _buildBulletItem(
                        context,
                        icon: Icons.visibility_outlined,
                        title: 'Pihak yang Mengakses',
                        desc: AppStrings.consentAccess,
                      ),
                      const SizedBox(height: 16),
                      _buildBulletItem(
                        context,
                        icon: Icons.history,
                        title: 'Masa Penyimpanan Bukti',
                        desc: AppStrings.consentRetention,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              if (_error != null) ...[
                Text(
                  _error!,
                  style: TextStyle(color: theme.colorScheme.error),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
              ],

              FilledButton(
                onPressed: _isLoading ? null : _handleAccept,
                child: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text(AppStrings.consentAgreeButton),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () {
                  ref.read(authControllerProvider.notifier).logout();
                },
                child: const Text(AppStrings.logout),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBulletItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String desc,
  }) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: theme.colorScheme.primary),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
              ),
              const SizedBox(height: 2),
              Text(
                desc,
                style: theme.textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
