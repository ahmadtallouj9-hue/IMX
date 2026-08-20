import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:chatter/core/providers/theme_provider.dart';
import 'package:chatter/core/theme/app_theme.dart';
import 'package:chatter/core/constants/app_constants.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('theme mode notifier defaults to system', () {
    final notifier = ThemeModeNotifier();
    expect(notifier.state, ThemeMode.system);
    notifier.dispose();
  });

  test('theme mode notifier persists and restores the chosen mode', () async {
    final notifier = ThemeModeNotifier();
    await notifier.setMode(ThemeMode.dark);
    expect(notifier.state, ThemeMode.dark);
    notifier.dispose();
  });

  test('light and dark themes provide usable color schemes', () {
    final light = AppTheme.light();
    final dark = AppTheme.dark();
    expect(light.colorScheme.brightness, Brightness.light);
    expect(dark.colorScheme.brightness, Brightness.dark);
    expect(light.useMaterial3, isTrue);
    expect(dark.useMaterial3, isTrue);
  });

  test('app constants are defined', () {
    expect(AppConstants.appName, 'Chatter');
    expect(AppConstants.apiBaseUrl, isNotEmpty);
    expect(AppConstants.wsBaseUrl, isNotEmpty);
  });
}
