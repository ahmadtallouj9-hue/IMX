import 'dart:async';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class OfflineMessage {
  const OfflineMessage({
    required this.conversationId,
    required this.body,
    required this.clientMessageId,
    required this.createdAt,
  });

  final String conversationId;
  final String body;
  final String clientMessageId;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => {
        'conversationId': conversationId,
        'body': body,
        'clientMessageId': clientMessageId,
        'createdAt': createdAt.toIso8601String(),
      };

  factory OfflineMessage.fromJson(Map<String, dynamic> json) {
    return OfflineMessage(
      conversationId: json['conversationId'] as String,
      body: json['body'] as String,
      clientMessageId: json['clientMessageId'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class OfflineMessageQueue {
  static const String _key = 'offline_message_queue';
  final List<OfflineMessage> _queue = [];
  final StreamController<List<OfflineMessage>> _controller =
      StreamController<List<OfflineMessage>>.broadcast();

  List<OfflineMessage> get queue => List.unmodifiable(_queue);
  Stream<List<OfflineMessage>> get onQueueChanged => _controller.stream;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString(_key);
    if (jsonString != null) {
      try {
        final list = jsonDecode(jsonString) as List<dynamic>;
        _queue.clear();
        _queue.addAll(list.map((e) => OfflineMessage.fromJson(e as Map<String, dynamic>)));
        _controller.add(_queue);
      } catch (_) {}
    }
  }

  Future<void> enqueue(String conversationId, String body, String clientMessageId) async {
    final message = OfflineMessage(
      conversationId: conversationId,
      body: body,
      clientMessageId: clientMessageId,
      createdAt: DateTime.now(),
    );
    _queue.add(message);
    await _save();
    _controller.add(_queue);
  }

  Future<OfflineMessage?> dequeue() async {
    if (_queue.isEmpty) return null;
    final message = _queue.removeAt(0);
    await _save();
    _controller.add(_queue);
    return message;
  }

  Future<void> removeByClientId(String clientMessageId) async {
    _queue.removeWhere((m) => m.clientMessageId == clientMessageId);
    await _save();
    _controller.add(_queue);
  }

  Future<void> clear() async {
    _queue.clear();
    await _save();
    _controller.add(_queue);
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = jsonEncode(_queue.map((m) => m.toJson()).toList());
    await prefs.setString(_key, jsonString);
  }

  void dispose() {
    _controller.close();
  }
}

final offlineMessageQueueProvider = OfflineMessageQueue();
