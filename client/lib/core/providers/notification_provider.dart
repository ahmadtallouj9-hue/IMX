import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/app_notification.dart';
import '../services/notification_service.dart';
import 'api_provider.dart';

final notificationServiceProvider = Provider<NotificationService>((ref) {
  return NotificationService(ref.watch(dioProvider));
});

class NotificationsNotifier extends StateNotifier<AsyncValue<List<AppNotification>>> {
  NotificationsNotifier(this._service) : super(const AsyncValue.loading()) {
    load();
  }

  final NotificationService _service;
  String? _nextCursor;
  bool _hasMore = true;

  bool get hasMore => _hasMore;

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.getNotifications();
      final notifications = result['notifications'] as List<AppNotification>;
      _nextCursor = result['nextCursor'] as String?;
      _hasMore = result['hasMore'] as bool;
      state = AsyncValue.data(notifications);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> loadMore() async {
    if (!_hasMore || _nextCursor == null) return;
    try {
      final result = await _service.getNotifications(cursor: _nextCursor);
      final notifications = result['notifications'] as List<AppNotification>;
      _nextCursor = result['nextCursor'] as String?;
      _hasMore = result['hasMore'] as bool;
      final current = state.value ?? [];
      state = AsyncValue.data([...current, ...notifications]);
    } catch (_) {}
  }

  Future<void> markRead(String id) async {
    await _service.markRead(id);
    final current = state.value;
    if (current == null) return;
    state = AsyncValue.data(current.map((n) {
      if (n.id == id) {
        return AppNotification(
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data,
          read: true,
          createdAt: n.createdAt,
        );
      }
      return n;
    }).toList());
  }

  Future<void> markAllRead() async {
    await _service.markAllRead();
    final current = state.value;
    if (current == null) return;
    state = AsyncValue.data(current.map((n) {
      return AppNotification(
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        read: true,
        createdAt: n.createdAt,
      );
    }).toList());
  }

  Future<void> remove(String id) async {
    await _service.remove(id);
    final current = state.value;
    if (current == null) return;
    state = AsyncValue.data(current.where((n) => n.id != id).toList());
  }
}

final notificationsProvider =
    StateNotifierProvider<NotificationsNotifier, AsyncValue<List<AppNotification>>>((ref) {
  return NotificationsNotifier(ref.watch(notificationServiceProvider));
});

final unreadNotificationCountProvider = StateProvider<int>((_) => 0);
