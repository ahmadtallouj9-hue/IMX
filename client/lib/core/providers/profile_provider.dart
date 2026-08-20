import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/profile_service.dart';
import 'api_provider.dart';

final profileServiceProvider = Provider<ProfileService>((ref) {
  return ProfileService(ref.watch(dioProvider));
});

class ProfileNotifier extends StateNotifier<AsyncValue<User?>> {
  ProfileNotifier(this._service) : super(const AsyncValue.loading());

  final ProfileService _service;

  Future<void> loadProfile() async {
    state = const AsyncValue.loading();
    try {
      final user = await _service.getMe();
      state = AsyncValue.data(user);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> updateProfile({String? displayName, String? bio, String? avatarUrl}) async {
    try {
      final user = await _service.updateProfile(
        displayName: displayName,
        bio: bio,
        avatarUrl: avatarUrl,
      );
      state = AsyncValue.data(user);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }
}

final profileProvider = StateNotifierProvider<ProfileNotifier, AsyncValue<User?>>((ref) {
  return ProfileNotifier(ref.watch(profileServiceProvider));
});
