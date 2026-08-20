import 'package:flutter/material.dart';

/// Central brand palette — change these values to re-brand the app.
class AppColors {
  AppColors._();

  static const Color primary = Color(0xFF4B5BFF);
  static const Color primaryContainer = Color(0xFFD9DDFF);
  static const Color onPrimaryContainer = Color(0xFF071046);
  static const Color secondary = Color(0xFF00A6A6);
  static const Color secondaryContainer = Color(0xFFB5F2F2);
  static const Color onSecondaryContainer = Color(0xFF062A2A);
  static const Color surface = Color(0xFFF7F8FC);
  static const Color surfaceDark = Color(0xFF12131A);
  static const Color background = Color(0xFFEFF1F7);
  static const Color backgroundDark = Color(0xFF0D0E13);
  static const Color onBackground = Color(0xFF1A1C21);
  static const Color onBackgroundDark = Color(0xFFE3E4EC);
  static const Color error = Color(0xFFBA1A1A);

  static const Color online = Color(0xFF31C48D);
  static const Color offline = Color(0xFF9AA0A6);
}

/// Light and dark [ThemeData] built on a Material 3 color scheme.
class AppTheme {
  AppTheme._();

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
      primary: AppColors.primary,
      secondary: AppColors.secondary,
      surface: AppColors.surface,
      error: AppColors.error,
    );
    return _base(scheme);
  }

  static ThemeData dark() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.dark,
      primary: AppColors.primary,
      secondary: AppColors.secondary,
      surface: AppColors.surfaceDark,
      error: AppColors.error,
    );
    return _base(scheme);
  }

  static ThemeData _base(ColorScheme scheme) {
    final isDark = scheme.brightness == Brightness.dark;
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: scheme.onSurface,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: scheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 68,
        backgroundColor: scheme.surface,
        indicatorColor: scheme.primaryContainer,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
      ),
      snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    );
  }
}
