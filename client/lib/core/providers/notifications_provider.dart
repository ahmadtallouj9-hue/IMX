import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/notifications_service.dart';
import 'api_provider.dart';

final notificationsServiceProvider = Provider<NotificationsService>((ref) {
  return NotificationsService(ref.watch(dioProvider));
});

class NotificationsState {
  const NotificationsState({
    this.notifications = const [],
    this.isLoading = false,
    this.hasMore = true,
    this.cursor,
    this.unreadCount = 0,
    this.error,
  });

  final List<NotificationItem> notifications;
  final bool isLoading;
  final bool hasMore;
  final String? cursor;
  final int unreadCount;
  final String? error;

  NotificationsState copyWith({
    List<NotificationItem>? notifications,
    bool? isLoading,
    bool? hasMore,
    String? cursor,
    int? unreadCount,
    String? error,
    bool clearCursor = false,
  }) {
    return NotificationsState(
      notifications: notifications ?? this.notifications,
      isLoading: isLoading ?? this.isLoading,
      hasMore: hasMore ?? this.hasMore,
      cursor: clearCursor ? null : (cursor ?? this.cursor),
      unreadCount: unreadCount ?? this.unreadCount,
      error: error,
    );
  }
}

class NotificationsNotifier extends StateNotifier<NotificationsState> {
  NotificationsNotifier(this._service) : super(const NotificationsState());

  final NotificationsService _service;

  Future<void> load() async {
    if (state.isLoading) return;
    state = state.copyWith(isLoading: true);
    try {
      final result = await _service.getNotifications();
      final notifications = (result['notifications'] as List)
          .map((n) => NotificationItem.fromJson(n as Map<String, dynamic>))
          .toList();
      final unreadCountResult = await _service.getUnreadCount();
      state = state.copyWith(
        notifications: notifications,
        isLoading: false,
        hasMore: result['nextCursor'] != null,
        cursor: result['nextCursor'] as String?,
        unreadCount: unreadCountResult['count'] as int,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadMore() async {
    if (state.isLoading || !state.hasMore || state.cursor == null) return;
    state = state.copyWith(isLoading: true);
    try {
      final result = await _service.getNotifications(cursor: state.cursor);
      final notifications = (result['notifications'] as List)
          .map((n) => NotificationItem.fromJson(n as Map<String, dynamic>))
          .toList();
      state = state.copyWith(
        notifications: [...state.notifications, ...notifications],
        isLoading: false,
        hasMore: result['nextCursor'] != null,
        cursor: result['nextCursor'] as String?,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> markAsRead(String id) async {
    try {
      await _service.markAsRead(id);
      state = state.copyWith(
        notifications: state.notifications.map((n) {
          if (n.id == id) {
            return NotificationItem(
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
        }).toList(),
        unreadCount: state.unreadCount > 0 ? state.unreadCount - 1 : 0,
      );
    } catch (_) {}
  }

  Future<void> markAllAsRead() async {
    try {
      await _service.markAllAsRead();
      state = state.copyWith(
        notifications: state.notifications.map((n) {
          return NotificationItem(
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            data: n.data,
            read: true,
            createdAt: n.createdAt,
          );
        }).toList(),
        unreadCount: 0,
      );
    } catch (_) {}
  }

  Future<void> delete(String id) async {
    try {
      await _service.deleteNotification(id);
      final removed = state.notifications.firstWhere((n) => n.id == id);
      state = state.copyWith(
        notifications: state.notifications.where((n) => n.id != id).toList(),
        unreadCount: removed.read ? state.unreadCount : (state.unreadCount > 0 ? state.unreadCount - 1 : 0),
      );
    } catch (_) {}
  }
}

final notificationsProvider = StateNotifierProvider<NotificationsNotifier, NotificationsState>((ref) {
  return NotificationsNotifier(ref.watch(notificationsServiceProvider));
});
