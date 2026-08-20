import 'package:dio/dio.dart';

class NotificationItem {
  final String id;
  final String type;
  final String title;
  final String? body;
  final Map<String, dynamic>? data;
  final bool read;
  final DateTime createdAt;

  NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    this.body,
    this.data,
    required this.read,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      body: json['body'] as String?,
      data: json['data'] as Map<String, dynamic>?,
      read: json['read'] as bool,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class NotificationsService {
  NotificationsService(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> getNotifications({String? cursor, int limit = 50}) async {
    final params = <String, dynamic>{'limit': limit};
    if (cursor != null) params['cursor'] = cursor;

    final response = await _dio.get('/notifications', queryParameters: params);
    return response.data as Map<String, dynamic>;
  }

  Future<void> markAsRead(String notificationId) async {
    await _dio.post('/notifications/$notificationId/read');
  }

  Future<void> markAllAsRead() async {
    await _dio.post('/notifications/read-all');
  }

  Future<Map<String, dynamic>> getUnreadCount() async {
    final response = await _dio.get('/notifications/unread-count');
    return response.data as Map<String, dynamic>;
  }

  Future<void> deleteNotification(String notificationId) async {
    await _dio.delete('/notifications/$notificationId');
  }
}
