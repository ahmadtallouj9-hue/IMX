import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/app_constants.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/token_storage.dart';

enum AuthStatus { initial, loading, authenticated, unauthenticated, error }

class AuthState {
  const AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.message,
  });

  final AuthStatus status;
  final User? user;
  final String? message;

  AuthState copyWith({AuthStatus? status, User? user, String? message, bool clearUser = false}) {
    return AuthState(
      status: status ?? this.status,
      user: clearUser ? null : (user ?? this.user),
      message: message,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._authService, this._tokenStorage) : super(const AuthState()) {
    _init();
  }

  final AuthService _authService;
  final TokenStorage _tokenStorage;

  Future<void> _init() async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      final accessToken = await _tokenStorage.getAccessToken();
      if (accessToken == null) {
        state = state.copyWith(status: AuthStatus.unauthenticated);
        return;
      }
      final user = await _authService.getMe();
      state = state.copyWith(status: AuthStatus.authenticated, user: user);
    } on DioException catch (e) {
      // Only clear tokens on 401; keep tokens on network errors
      if (e.response?.statusCode == 401) {
        await _tokenStorage.clearTokens();
        state = state.copyWith(status: AuthStatus.unauthenticated, clearUser: true);
      } else {
        // Network error or server down — keep user as authenticated
        // so they don't get logged out. They'll retry on next action.
        final cachedUser = await _getCachedUser();
        if (cachedUser != null) {
          state = state.copyWith(status: AuthStatus.authenticated, user: cachedUser);
        } else {
          state = state.copyWith(status: AuthStatus.unauthenticated);
        }
      }
    } catch (_) {
      final cachedUser = await _getCachedUser();
      if (cachedUser != null) {
        state = state.copyWith(status: AuthStatus.authenticated, user: cachedUser);
      } else {
        state = state.copyWith(status: AuthStatus.unauthenticated);
      }
    }
  }

  Future<void> login({required String identifier, required String password}) async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      final response = await _authService.login(identifier: identifier, password: password);
      await _tokenStorage.saveTokens(
        accessToken: response.tokens.accessToken,
        refreshToken: response.tokens.refreshToken,
      );
      await _cacheUser(response.user);
      state = state.copyWith(status: AuthStatus.authenticated, user: response.user);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        message: _extractMessage(e),
      );
    }
  }

  Future<void> register({
    required String username,
    required String email,
    required String password,
    String? displayName,
  }) async {
    state = state.copyWith(status: AuthStatus.loading);
    try {
      final response = await _authService.register(
        username: username,
        email: email,
        password: password,
        displayName: displayName,
      );
      await _tokenStorage.saveTokens(
        accessToken: response.tokens.accessToken,
        refreshToken: response.tokens.refreshToken,
      );
      await _cacheUser(response.user);
      state = state.copyWith(status: AuthStatus.authenticated, user: response.user);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.error,
        message: _extractMessage(e),
      );
    }
  }

  Future<void> logout() async {
    try {
      await _authService.logout();
    } catch (_) {
      // Logout even if the server call fails.
    }
    await _tokenStorage.clearTokens();
    state = state.copyWith(status: AuthStatus.unauthenticated, clearUser: true);
  }

  Future<void> refreshUser() async {
    try {
      final user = await _authService.getMe();
      state = state.copyWith(user: user);
      await _cacheUser(user);
    } catch (_) {}
  }

  Future<void> _cacheUser(User user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('cached_user', jsonEncode(user.toJson()));
  }

  Future<User?> _getCachedUser() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString('cached_user');
    if (jsonString == null) return null;
    try {
      final map = jsonDecode(jsonString) as Map<String, dynamic>;
      return User.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  String _extractMessage(dynamic error) {
    if (error is Exception) {
      return error.toString().replaceFirst('Exception: ', '');
    }
    return 'An unexpected error occurred';
  }
}

// Providers ---------------------------------------------------------------

final tokenStorageProvider = Provider<TokenStorage>((_) => TokenStorage());

final authServiceProvider = Provider<AuthService>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  final dio = Dio(BaseOptions(
    baseUrl: AppConstants.apiBaseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 20),
    headers: {'Accept': 'application/json'},
  ));
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      if (!options.path.contains('/auth/login') &&
          !options.path.contains('/auth/register') &&
          !options.path.contains('/auth/refresh')) {
        final token = await tokenStorage.getAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
      }
      handler.next(options);
    },
  ));
  return AuthService(dio);
});

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(authServiceProvider), ref.watch(tokenStorageProvider));
});
