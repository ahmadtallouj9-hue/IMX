import 'user.dart';

class FriendRequest {
  const FriendRequest({required this.id, required this.user, required this.createdAt});

  final String id;
  final User user;
  final DateTime createdAt;

  factory FriendRequest.fromJson(Map<String, dynamic> json) {
    return FriendRequest(
      id: json['id'] as String,
      user: User.fromJson(json['user'] as Map<String, dynamic>),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
