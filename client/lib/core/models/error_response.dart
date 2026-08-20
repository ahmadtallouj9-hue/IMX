class AppException implements Exception {
  AppException({required this.code, required this.message});

  final String code;
  final String message;

  @override
  String toString() => 'AppException($code): $message';
}
