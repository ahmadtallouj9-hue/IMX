import 'user.dart';

class Conversation {
  const Conversation({
    required this.id,
    required this.type,
    this.title,
    this.imageUrl,
    this.members = const [],
    this.lastMessage,
    required this.lastMessageAt,
    this.unreadCount = 0,
  });

  final String id;
  final String type;
  final String? title;
  final String? imageUrl;
  final List<User> members;
  final LastMessage? lastMessage;
  final DateTime lastMessageAt;
  final int unreadCount;

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] as String,
      type: json['type'] as String,
      title: json['title'] as String?,
      imageUrl: json['imageUrl'] as String?,
      members: (json['members'] as List<dynamic>? ?? [])
          .map((m) => User.fromJson(m as Map<String, dynamic>))
          .toList(),
      lastMessage: json['lastMessage'] != null
          ? LastMessage.fromJson(json['lastMessage'] as Map<String, dynamic>)
          : null,
      lastMessageAt: DateTime.parse(json['lastMessageAt'] as String),
      unreadCount: json['unreadCount'] as int? ?? 0,
    );
  }
}

class LastMessage {
  const LastMessage({required this.body, required this.senderName, required this.createdAt});

  final String body;
  final String senderName;
  final DateTime createdAt;

  factory LastMessage.fromJson(Map<String, dynamic> json) {
    return LastMessage(
      body: json['body'] as String? ?? '',
      senderName: json['senderName'] as String? ?? '',
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
