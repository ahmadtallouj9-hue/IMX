import 'package:dio/dio.dart';
import '../models/user.dart';
import '../models/friend_request.dart';

class FriendsService {
  FriendsService(this._dio);

  final Dio _dio;

  Future<List<User>> searchUsers(String query) async {
    final response = await _dio.get('/users/search', queryParameters: {'q': query});
    final data = response.data as Map<String, dynamic>;
    final users = data['users'] as List<dynamic>;
    return users.map((u) => User.fromJson(u as Map<String, dynamic>)).toList();
  }

  Future<List<User>> getFriends() async {
    final response = await _dio.get('/friends');
    final data = response.data as Map<String, dynamic>;
    final friends = data['friends'] as List<dynamic>;
    return friends.map((u) => User.fromJson(u as Map<String, dynamic>)).toList();
  }

  Future<Map<String, List<FriendRequest>>> getRequests() async {
    final response = await _dio.get('/friends/requests');
    final data = response.data as Map<String, dynamic>;
    return {
      'received': (data['received'] as List<dynamic>)
          .map((r) => FriendRequest.fromJson(r as Map<String, dynamic>))
          .toList(),
      'sent': (data['sent'] as List<dynamic>)
          .map((r) => FriendRequest.fromJson(r as Map<String, dynamic>))
          .toList(),
    };
  }

  Future<void> sendRequest(String recipientId) async {
    await _dio.post('/friends/request', data: {'recipientId': recipientId});
  }

  Future<void> acceptRequest(String requestId) async {
    await _dio.post('/friends/accept/$requestId');
  }

  Future<void> rejectRequest(String requestId) async {
    await _dio.post('/friends/reject/$requestId');
  }

  Future<void> removeFriend(String friendId) async {
    await _dio.delete('/friends/$friendId');
  }

  Future<void> blockUser(String userId) async {
    await _dio.post('/users/block/$userId');
  }

  Future<void> unblockUser(String userId) async {
    await _dio.delete('/users/block/$userId');
  }

  Future<List<User>> getBlockedUsers() async {
    final response = await _dio.get('/users/blocked');
    final data = response.data as Map<String, dynamic>;
    final blocked = data['blocked'] as List<dynamic>;
    return blocked.map((u) => User.fromJson(u as Map<String, dynamic>)).toList();
  }
}
