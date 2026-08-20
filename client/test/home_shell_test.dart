import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:chatter/app/app.dart';
import 'package:chatter/core/providers/auth_provider.dart';
import 'package:chatter/core/providers/chat_provider.dart';
import 'package:chatter/core/models/user.dart';
import 'package:chatter/core/models/conversation.dart';
import 'package:dio/dio.dart';
import 'package:chatter/core/services/chat_service.dart';

class FakeChatService extends ChatService {
  FakeChatService() : super(Dio());

  @override
  Future<List<Conversation>> getConversations() async => [];

  @override
  Future<Map<String, dynamic>> getMessages(String conversationId, {String? cursor}) async => {
        'messages': <dynamic>[],
        'nextCursor': null as String?,
        'hasMore': false,
      };
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  ProviderScope testApp() {
    return ProviderScope(
      overrides: [
        authProvider.overrideWith((ref) => AuthNotifier(
          ref.read(authServiceProvider),
          ref.read(tokenStorageProvider),
        )..state = const AuthState(
            status: AuthStatus.authenticated,
            user: User(id: '1', username: 'test', displayName: 'Test User'),
          )),
        chatServiceProvider.overrideWithValue(FakeChatService()),
      ],
      child: const ChatterApp(),
    );
  }

  testWidgets('app shell renders navigation and default screen', (tester) async {
    await tester.pumpWidget(testApp());
    await tester.pump();
    await tester.pump();

    expect(find.text('Chats'), findsWidgets);
    expect(find.text('Friends'), findsWidgets);
    expect(find.text('Notifications'), findsWidgets);
    expect(find.text('Profile'), findsWidgets);
    expect(find.text('Settings'), findsWidgets);
  });

  testWidgets('narrow layout uses a bottom navigation bar', (tester) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(testApp());
    await tester.pump();
    await tester.pump();

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(NavigationRail), findsNothing);
  });

  testWidgets('wide layout uses a navigation rail sidebar', (tester) async {
    tester.view.physicalSize = const Size(1400, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(testApp());
    await tester.pump();
    await tester.pump();

    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
  });
}
