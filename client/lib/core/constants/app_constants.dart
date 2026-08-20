/// Central application constants.
///
/// Branding is centralized here so the whole app can be renamed/re-skinned in
/// one place. API endpoints can be overridden per platform at build time with
/// `--dart-define=API_BASE_URL=...`.
class AppConstants {
  AppConstants._();

  static const String appName = 'Cove';
  static const String tagline = 'Close conversations, quietly.';

  /// Default API base URL.
  /// Windows desktop uses localhost. Android emulator: --dart-define=API_BASE_URL=http://10.0.2.2:8080
  /// Physical Android device: --dart-define=API_BASE_URL=http://<your-lan-ip>:8080
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://192.168.1.44:8080',
  );

  static const String wsBaseUrl = String.fromEnvironment(
    'WS_BASE_URL',
    defaultValue: 'http://192.168.1.44:8080',
  );

  static String? resolveMediaUrl(String? url) {
    if (url == null || url.isEmpty) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return '$apiBaseUrl$url';
  }
}
