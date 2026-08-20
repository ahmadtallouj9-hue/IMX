import 'package:dio/dio.dart';
import '../models/app_notification.dart';

class NotificationService {
  NotificationService(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> getNotifications({String? cursor, int limit = 30}) async {
    final response = await _dio.get('/notifications', queryParameters: {
      if (cursor != null) 'cursor': cursor,
      'limit': limit,
    });
    final data = response.data as Map<String, dynamic>;
    return {
      'notifications': (data['notifications'] as List<dynamic>)
          .map((n) => AppNotification.fromJson(n as Map<String, dynamic>))
          .toList(),
      'nextCursor': data['nextCursor'] as String?,
      'hasMore': data['hasMore'] as bool,
    };
  }

  Future<void> markRead(String id) async {
    await _dio.post('/notifications/$id/read');
  }

  Future<void> markAllRead() async {
    await _dio.post('/notifications/read-all');
  }

  Future<int> getUnreadCount() async {
    final response = await _dio.get('/notifications/unread-count');
    return (response.data as Map<String, dynamic>)['count'] as int;
  }

  Future<void> remove(String id) async {
    await _dio.delete('/notifications/$id');
  }
}
