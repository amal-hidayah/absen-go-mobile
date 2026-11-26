import 'package:flutter/services.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/failure.dart';
import '../../data/models/company_settings.dart';
import '../../data/repositories/attendance_repository.dart';
import '../../data/repositories/settings_repository.dart';
import '../auth/auth_controller.dart';

enum LocationStatus {
  initial,
  checking,
  inside,
  outside,
  lowAccuracy,
  disabled,
  permissionDenied,
  error,
}

class AttendanceState {
  final bool isLoading;
  final bool isSubmitting;
  final Position? position;
  final int? distanceM;
  final LocationStatus locationStatus;
  final String? locationErrorMessage;
  final XFile? selfieFile;
  final Uint8List? compressedPhotoBytes;
  final Map<String, dynamic>? successResult;
  final Failure? failure;
  final CompanySettings? settings;

  const AttendanceState({
    this.isLoading = false,
    this.isSubmitting = false,
    this.position,
    this.distanceM,
    this.locationStatus = LocationStatus.initial,
    this.locationErrorMessage,
    this.selfieFile,
    this.compressedPhotoBytes,
    this.successResult,
    this.failure,
    this.settings,
  });

  AttendanceState copyWith({
    bool? isLoading,
    bool? isSubmitting,
    Position? position,
    int? distanceM,
    LocationStatus? locationStatus,
    String? locationErrorMessage,
    XFile? selfieFile,
    Uint8List? compressedPhotoBytes,
    Map<String, dynamic>? successResult,
    Failure? failure,
    CompanySettings? settings,
    bool clearSelfie = false,
    bool clearResult = false,
    bool clearFailure = false,
  }) {
    return AttendanceState(
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      position: position ?? this.position,
      distanceM: distanceM ?? this.distanceM,
      locationStatus: locationStatus ?? this.locationStatus,
      locationErrorMessage: locationErrorMessage ?? this.locationErrorMessage,
      selfieFile: clearSelfie ? null : (selfieFile ?? this.selfieFile),
      compressedPhotoBytes: clearSelfie
          ? null
          : (compressedPhotoBytes ?? this.compressedPhotoBytes),
      successResult: clearResult ? null : (successResult ?? this.successResult),
      failure: clearFailure ? null : (failure ?? this.failure),
      settings: settings ?? this.settings,
    );
  }
}

final attendanceControllerProvider =
    NotifierProvider<AttendanceController, AttendanceState>(
      AttendanceController.new,
    );

class AttendanceController extends Notifier<AttendanceState> {
  AttendanceRepository get _attendanceRepo =>
      ref.read(attendanceRepositoryProvider);
  SettingsRepository get _settingsRepo => ref.read(settingsRepositoryProvider);
  AuthState get _authState => ref.read(authControllerProvider);

  @override
  AttendanceState build() {
    Future.microtask(() => init());
    return const AttendanceState();
  }

  Future<void> init() async {
    state = state.copyWith(isLoading: true);
    try {
      final settings = await _settingsRepo.getPublicSettings();
      state = state.copyWith(settings: settings, isLoading: false);
      await fetchCurrentPosition();
    } catch (_) {
      state = state.copyWith(isLoading: false);
    }
  }

  /// Mengambil lokasi GPS dengan akurasi tinggi dan timeout 20 detik
  Future<void> fetchCurrentPosition() async {
    state = state.copyWith(
      locationStatus: LocationStatus.checking,
      clearFailure: true,
    );

    // 1. Cek Service GPS
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      state = state.copyWith(
        locationStatus: LocationStatus.disabled,
        locationErrorMessage:
            'Layanan lokasi GPS belum aktif di perangkat Anda.',
      );
      return;
    }

    // 2. Cek Permission
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        state = state.copyWith(
          locationStatus: LocationStatus.permissionDenied,
          locationErrorMessage: 'Izin akses lokasi ditolak oleh pengguna.',
        );
        return;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      state = state.copyWith(
        locationStatus: LocationStatus.permissionDenied,
        locationErrorMessage: 'Izin akses lokasi ditolak permanen. Buka pengaturan untuk mengaktifkan.',
      );
      return;
    }

    // 3. Ambil posisi
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );

      // Hitung jarak ke kantor di client (hanya untuk tampilan)
      int? dist;
      var locStatus = LocationStatus.inside;

      final s = state.settings;
      if (s != null && s.officeLat != null && s.officeLng != null) {
        final d = Geolocator.distanceBetween(
          s.officeLat!,
          s.officeLng!,
          pos.latitude,
          pos.longitude,
        );
        dist = d.round();

        if (pos.accuracy > s.maxAccuracyM) {
          locStatus = LocationStatus.lowAccuracy;
        } else if (dist > s.officeRadiusM) {
          locStatus = LocationStatus.outside;
        } else {
          locStatus = LocationStatus.inside;
        }
      }

      state = state.copyWith(
        position: pos,
        distanceM: dist,
        locationStatus: locStatus,
      );
    } catch (e) {
      state = state.copyWith(
        locationStatus: LocationStatus.error,
        locationErrorMessage: 'Gagal mendapatkan titik GPS (waktu tunggu habis). Bergeserlah ke tempat terbuka.',
      );
    }
  }

  /// Menerima foto dari layar kamera in-app lalu mengompresnya.
  Future<void> attachSelfie(XFile picked) async {
    try {
      final compressedBytes = await FlutterImageCompress.compressWithFile(
        picked.path,
        minWidth: 1080,
        minHeight: 1440,
        quality: 80,
        format: CompressFormat.jpeg,
      );

      if (compressedBytes == null) {
        state = state.copyWith(
          failure: const Failure(
            code: 'COMPRESS_FAILED',
            message: 'Gagal memproses dan mengompres foto selfie.',
          ),
        );
        return;
      }

      // Validasi ukuran < 5MB
      if (compressedBytes.lengthInBytes > 5 * 1024 * 1024) {
        state = state.copyWith(
          failure: const Failure(
            code: 'FILE_TOO_LARGE',
            message: 'Ukuran foto melebihi batas 5 MB.',
          ),
        );
        return;
      }

      state = state.copyWith(
        selfieFile: picked,
        compressedPhotoBytes: compressedBytes,
        clearFailure: true,
      );
    } catch (e) {
      state = state.copyWith(
        failure: Failure(
          code: 'CAMERA_ERROR',
          message: 'Gagal memproses foto selfie: $e',
          nextStep: 'Coba ambil foto kembali menggunakan kamera depan.',
        ),
      );
    }
  }

  void clearSelfie() {
    state = state.copyWith(clearSelfie: true);
  }

  void clearResult() {
    state = state.copyWith(clearResult: true);
  }

  /// Mengirim absensi (upload foto + panggil RPC)
  Future<void> submitAttendance() async {
    if (state.isSubmitting) return; // Kunci proses (concurrency lock)

    final pos = state.position;
    final photoBytes = state.compressedPhotoBytes;
    final emp = _authState.profile?.employee;

    if (emp == null) {
      state = state.copyWith(
        failure: const Failure(
          code: 'TANPA_PROFIL',
          message: 'Profil karyawan tidak ditemukan.',
        ),
      );
      return;
    }

    if (pos == null) {
      state = state.copyWith(
        failure: const Failure(
          code: 'NO_LOCATION',
          message: 'Titik lokasi belum tersedia. Tekan tombol Perbarui Lokasi.',
        ),
      );
      return;
    }

    if (photoBytes == null) {
      state = state.copyWith(
        failure: const Failure(
          code: 'NO_SELFIE',
          message: 'Foto selfie bukti kehadiran wajib diambil.',
        ),
      );
      return;
    }

    state = state.copyWith(isSubmitting: true, clearFailure: true);

    String? uploadedPath;
    try {
      // 1. Unggah foto ke Supabase Storage
      uploadedPath = await _attendanceRepo.uploadAttendancePhoto(
        employeeId: emp.id,
        photoBytes: photoBytes,
      );

      // 2. Panggil RPC record_attendance_geo
      final rpcRes = await _attendanceRepo.recordAttendanceGeo(
        lat: pos.latitude,
        lng: pos.longitude,
        accuracyM: pos.accuracy,
        isMocked: pos.isMocked,
        photoPath: uploadedPath,
      );

      final isOk = rpcRes['ok'] == true;
      if (!isOk) {
        // Rollback hapus foto (best effort)
        await _attendanceRepo.deletePhoto(uploadedPath);

        HapticFeedback.heavyImpact(); // Haptic kuat untuk penolakan
        state = state.copyWith(
          isSubmitting: false,
          failure: Failure(
            code: rpcRes['kode']?.toString() ?? 'ERROR',
            message:
                rpcRes['pesan']?.toString() ?? 'Presensi ditolak oleh server.',
          ),
        );
        return;
      }

      // Sukses
      HapticFeedback.mediumImpact(); // Haptic sedang untuk sukses
      state = state.copyWith(
        isSubmitting: false,
        successResult: rpcRes,
        clearSelfie: true,
      );
    } catch (e) {
      if (uploadedPath != null) {
        await _attendanceRepo.deletePhoto(uploadedPath);
      }
      HapticFeedback.heavyImpact();
      state = state.copyWith(
        isSubmitting: false,
        failure: Failure(
          code: 'SUBMIT_ERROR',
          message: e is Failure ? e.message : 'Gagal mengirim presensi: $e',
        ),
      );
    }
  }
}
