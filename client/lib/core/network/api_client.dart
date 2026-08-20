import 'package:dio/dio.dart';
import '../constants/app_constants.dart';

/// Factory for the shared Dio HTTP client.
///
/// Phase 2 adds an auth interceptor that attaches the access token and
/// transparently refreshes expired tokens on 401 responses.
class ApiClient {
  ApiClient._();

  static Dio create({String? token}) {
    return Dio(
      BaseOptions(
        baseUrl: AppConstants.apiBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 20),
        sendTimeout: const Duration(seconds: 20),
        headers: <String, dynamic>{
          'Accept': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
      ),
    );
  }
}
