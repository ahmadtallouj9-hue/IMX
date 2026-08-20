import 'package:dio/dio.dart';
import '../services/auth_service.dart';
import '../services/token_storage.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._dio, this._tokenStorage, this._authService);

  final Dio _dio;
  final TokenStorage _tokenStorage;
  final AuthService _authService;

  bool _isRefreshing = false;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.path == '/auth/login' ||
        options.path == '/auth/register' ||
        options.path == '/auth/refresh') {
      return handler.next(options);
    }

    final accessToken = await _tokenStorage.getAccessToken();
    if (accessToken != null) {
      options.headers['Authorization'] = 'Bearer $accessToken';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401) {
      return handler.next(err);
    }

    final requestOptions = err.requestOptions;
    if (requestOptions.path == '/auth/refresh') {
      await _tokenStorage.clearTokens();
      return handler.next(err);
    }

    if (_isRefreshing) {
      final newToken = await _tokenStorage.getAccessToken();
      if (newToken != null) {
        requestOptions.headers['Authorization'] = 'Bearer $newToken';
        try {
          final response = await _dio.fetch(requestOptions);
          return handler.resolve(response);
        } catch (_) {
          return handler.next(err);
        }
      }
      return handler.next(err);
    }

    _isRefreshing = true;
    try {
      final refreshToken = await _tokenStorage.getRefreshToken();
      if (refreshToken == null) {
        await _tokenStorage.clearTokens();
        return handler.next(err);
      }

      final tokens = await _authService.refresh(refreshToken: refreshToken);
      await _tokenStorage.saveTokens(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      );

      requestOptions.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
      final response = await _dio.fetch(requestOptions);
      return handler.resolve(response);
    } catch (_) {
      await _tokenStorage.clearTokens();
      return handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }
}
