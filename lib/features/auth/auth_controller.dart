import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/failure.dart';
import '../../data/models/user_profile.dart';
import '../../data/repositories/auth_repository.dart';

class AuthState {
  final bool isLoading;
  final UserProfile? profile;
  final Failure? failure;
  final bool isInitialized;

  const AuthState({
    this.isLoading = false,
    this.profile,
    this.failure,
    this.isInitialized = false,
  });

  bool get isAuthenticated => profile != null;
  bool get isAdmin => profile?.isAdmin ?? false;
  bool get isEmployee => profile?.isEmployee ?? false;

  AuthState copyWith({
    bool? isLoading,
    UserProfile? profile,
    Failure? failure,
    bool? isInitialized,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      profile: profile ?? this.profile,
      failure: failure,
      isInitialized: isInitialized ?? this.isInitialized,
    );
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

class AuthController extends Notifier<AuthState> {
  AuthRepository get _authRepo => ref.read(authRepositoryProvider);

  @override
  AuthState build() {
    Future.microtask(() => initializeSession());
    return const AuthState();
  }

  /// Memulihkan sesi saat aplikasi pertama kali dibuka
  Future<void> initializeSession() async {
    state = state.copyWith(isLoading: true);
    try {
      final profile = await _authRepo.getCurrentUserProfile();
      state = state.copyWith(
        isLoading: false,
        profile: profile,
        isInitialized: true,
      );
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        profile: null,
        isInitialized: true,
      );
    }
  }

  /// Melakukan login username & kata sandi
  Future<bool> login({
    required String username,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, failure: null);
    try {
      final profile = await _authRepo.login(
        username: username,
        password: password,
      );
      state = state.copyWith(
        isLoading: false,
        profile: profile,
        failure: null,
      );
      return true;
    } on Failure catch (f) {
      state = state.copyWith(isLoading: false, failure: f);
      return false;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        failure: Failure(
          code: 'UNKNOWN_ERROR',
          message: 'Terjadi kesalahan sistem: $e',
        ),
      );
      return false;
    }
  }

  /// Memperbarui profil (misal setelah menyetujui consent)
  void updateProfile(UserProfile newProfile) {
    state = state.copyWith(profile: newProfile);
  }

  /// Logout
  Future<void> logout() async {
    await _authRepo.signOut();
    state = const AuthState(isInitialized: true);
  }
}
