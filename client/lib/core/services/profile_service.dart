import 'package:dio/dio.dart';
import '../models/user.dart';

class ProfileService {
  ProfileService(this._dio);
  final Dio _dio;

  Future<User> getMe() async {
    final response = await _dio.get('/users/me');
    return User.fromJson(response.data['user'] as Map<String, dynamic>);
  }

  Future<User> updateProfile({
    String? displayName,
    String? bio,
    String? avatarUrl,
  }) async {
    final data = <String, dynamic>{};
    if (displayName != null) data['displayName'] = displayName;
    if (bio != null) data['bio'] = bio;
    if (avatarUrl != null) data['avatarUrl'] = avatarUrl;

    final response = await _dio.patch('/users/me', data: data);
    return User.fromJson(response.data['user'] as Map<String, dynamic>);
  }
}
