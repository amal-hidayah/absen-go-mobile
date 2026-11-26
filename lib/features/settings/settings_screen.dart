import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../app/theme.dart';
import '../../core/strings.dart';
import '../../data/models/company_settings.dart';
import '../../data/repositories/settings_repository.dart';
import '../../shared/widgets/loading_state.dart';
import '../../shared/widgets/page_header.dart';
import '../../shared/widgets/responsive_actions.dart';
import '../auth/auth_controller.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _companyNameController = TextEditingController();
  final _startTimeController = TextEditingController();
  final _endTimeController = TextEditingController();
  final _toleranceController = TextEditingController();
  final _latController = TextEditingController();
  final _lngController = TextEditingController();
  final _radiusController = TextEditingController();
  final _maxAccuracyController = TextEditingController();

  bool _isLoading = false;
  bool _isGettingLocation = false;
  String? _error;
  String? _successMessage;
  Position? _currentDevicePosition;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  @override
  void dispose() {
    _companyNameController.dispose();
    _startTimeController.dispose();
    _endTimeController.dispose();
    _toleranceController.dispose();
    _latController.dispose();
    _lngController.dispose();
    _radiusController.dispose();
    _maxAccuracyController.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final s = await ref.read(settingsRepositoryProvider).getCompanySettings();
      _companyNameController.text = s.companyName;
      _startTimeController.text = s.workStartTime;
      _endTimeController.text = s.workEndTime;
      _toleranceController.text = s.lateToleranceMinutes.toString();
      _latController.text = s.officeLat?.toString() ?? '';
      _lngController.text = s.officeLng?.toString() ?? '';
      _radiusController.text = s.officeRadiusM.toString();
      _maxAccuracyController.text = s.maxAccuracyM.toString();

      if (mounted) setState(() => _isLoading = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = 'Gagal memuat pengaturan: $e';
        });
      }
    }
  }

  /// Tombol: Pakai lokasi perangkat ini
  Future<void> _useCurrentDeviceLocation() async {
    setState(() => _isGettingLocation = true);
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw 'Layanan lokasi GPS perangkat belum aktif.';
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw 'Izin lokasi perangkat ditolak.';
        }
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );

      setState(() {
        _currentDevicePosition = pos;
        _latController.text = pos.latitude.toStringAsFixed(7);
        _lngController.text = pos.longitude.toStringAsFixed(7);
        _isGettingLocation = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Koordinat GPS terisi: ${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)} (Akurasi: ±${pos.accuracy.round()} m)',
            ),
          ),
        );
      }
    } catch (e) {
      setState(() => _isGettingLocation = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Gagal membaca GPS: $e')));
      }
    }
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
      _successMessage = null;
    });

    try {
      final lat = double.tryParse(_latController.text.trim());
      final lng = double.tryParse(_lngController.text.trim());
      final radius = int.tryParse(_radiusController.text.trim()) ?? 150;
      final maxAcc = int.tryParse(_maxAccuracyController.text.trim()) ?? 100;
      final tol = int.tryParse(_toleranceController.text.trim()) ?? 15;

      final updated = CompanySettings(
        id: 1,
        companyName: _companyNameController.text.trim(),
        workStartTime: _startTimeController.text.trim(),
        workEndTime: _endTimeController.text.trim(),
        lateToleranceMinutes: tol,
        officeLat: lat,
        officeLng: lng,
        officeRadiusM: radius,
        maxAccuracyM: maxAcc,
      );

      await ref.read(settingsRepositoryProvider).updateCompanySettings(updated);

      if (mounted) {
        setState(() {
          _isLoading = false;
          _successMessage =
              'Pengaturan kantor berhasil disimpan dan langsung berlaku.';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _error = 'Gagal menyimpan pengaturan: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final authProfile = ref.watch(authControllerProvider).profile;

    if (_isLoading && _companyNameController.text.isEmpty) {
      return const Scaffold(body: LoadingState());
    }

    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              PageHeader(
                title: AppStrings.tabSettings,
                subtitle: 'Waktu kerja, koordinat kantor & radius geofence',
              ),
              ResponsiveActions(
                children: [
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.button),
                      ),
                    ),
                    icon: const Icon(Icons.refresh_outlined, size: 18),
                    label: const Text('Segarkan'),
                    onPressed: _loadSettings,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_successMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.statusHadirBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.check_circle_outlined,
                        color: AppColors.statusHadirText,
                        size: 18,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _successMessage!,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppColors.statusHadirText,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

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
                const SizedBox(height: 16),
              ],

              // 1. BAGIAN KEBIJAKAN WAKTU KERJA
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Kebijakan Waktu Kerja',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _companyNameController,
                        decoration: const InputDecoration(
                          labelText: 'Nama Perusahaan',
                        ),
                        validator: (v) => (v == null || v.trim().isEmpty)
                            ? 'Wajib diisi'
                            : null,
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _startTimeController,
                              decoration: const InputDecoration(
                                labelText: 'Jam Masuk (HH:mm)',
                              ),
                              validator: (v) => (v == null || v.trim().isEmpty)
                                  ? 'Wajib diisi'
                                  : null,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _endTimeController,
                              decoration: const InputDecoration(
                                labelText: 'Jam Pulang (HH:mm)',
                              ),
                              validator: (v) => (v == null || v.trim().isEmpty)
                                  ? 'Wajib diisi'
                                  : null,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _toleranceController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Toleransi Keterlambatan (0 - 120 Menit)',
                          hintText: '15',
                        ),
                        validator: (v) {
                          final n = int.tryParse(v ?? '');
                          if (n == null || n < 0 || n > 120) {
                            return 'Toleransi harus 0 sampai 120 menit';
                          }
                          return null;
                        },
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // 2. BAGIAN LOKASI KANTOR (GEOFENCE)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Titik Lokasi & Radius Kantor',
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          Icon(
                            Icons.location_on_outlined,
                            size: 18,
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Perubahan radius dan koordinat berlaku untuk presensi berikutnya.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppColors.statusTerlambatText,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Tombol: Pakai lokasi perangkat ini
                      OutlinedButton.icon(
                        onPressed: _isGettingLocation
                            ? null
                            : _useCurrentDeviceLocation,
                        icon: _isGettingLocation
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.my_location_outlined),
                        label: const Text('Pakai Lokasi Perangkat Ini'),
                      ),
                      if (_currentDevicePosition != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Pembacaan perangkat: ${_currentDevicePosition!.latitude.toStringAsFixed(6)}, ${_currentDevicePosition!.longitude.toStringAsFixed(6)} (±${_currentDevicePosition!.accuracy.round()} m)',
                          style: TextStyle(
                            fontSize: 11,
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),

                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _latController,
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                              decoration: const InputDecoration(
                                labelText: 'Latitude',
                              ),
                              validator: (v) => (v == null || v.trim().isEmpty)
                                  ? 'Wajib diisi'
                                  : null,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _lngController,
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                              decoration: const InputDecoration(
                                labelText: 'Longitude',
                              ),
                              validator: (v) => (v == null || v.trim().isEmpty)
                                  ? 'Wajib diisi'
                                  : null,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _radiusController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Radius Izin (25 - 1000 m)',
                                hintText: '150',
                              ),
                              validator: (v) {
                                final n = int.tryParse(v ?? '');
                                if (n == null || n < 25 || n > 1000) {
                                  return 'Radius 25 s/d 1000 meter';
                                }
                                return null;
                              },
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _maxAccuracyController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Batas Akurasi (25 - 200 m)',
                                hintText: '100',
                              ),
                              validator: (v) {
                                final n = int.tryParse(v ?? '');
                                if (n == null || n < 25 || n > 200) {
                                  return 'Batas 25 s/d 200 meter';
                                }
                                return null;
                              },
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // 3. INFORMASI AKUN LOGIN
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Akun Administrator',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Email: ${authProfile?.account.email ?? "-"}',
                        style: theme.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Username: ${authProfile?.account.username ?? "-"}',
                        style: theme.textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Tombol Simpan
              FilledButton(
                onPressed: _isLoading ? null : _handleSave,
                child: _isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Simpan Perubahan Setelan'),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
