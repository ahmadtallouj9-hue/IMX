import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../models/friend_request.dart';
import '../services/friends_service.dart';
import 'api_provider.dart';

// Service provider
final friendsServiceProvider = Provider<FriendsService>((ref) {
  return FriendsService(ref.watch(dioProvider));
});

// Search state
class SearchState {
  const SearchState({this.results = const [], this.loading = false, this.query = ''});

  final List<User> results;
  final bool loading;
  final String query;

  SearchState copyWith({List<User>? results, bool? loading, String? query}) {
    return SearchState(
      results: results ?? this.results,
      loading: loading ?? this.loading,
      query: query ?? this.query,
    );
  }
}

class SearchNotifier extends StateNotifier<SearchState> {
  SearchNotifier(this._service) : super(const SearchState());

  final FriendsService _service;

  Future<void> search(String query) async {
    if (query.trim().length < 2) {
      state = state.copyWith(results: [], query: query);
      return;
    }
    state = state.copyWith(loading: true, query: query);
    try {
      final results = await _service.searchUsers(query);
      state = state.copyWith(results: results, loading: false);
    } catch (_) {
      state = state.copyWith(loading: false);
    }
  }

  void clear() {
    state = const SearchState();
  }
}

final searchProvider = StateNotifierProvider<SearchNotifier, SearchState>((ref) {
  return SearchNotifier(ref.watch(friendsServiceProvider));
});

// Friends list state
class FriendsNotifier extends StateNotifier<AsyncValue<List<User>>> {
  FriendsNotifier(this._service) : super(const AsyncValue.loading()) {
    load();
  }

  final FriendsService _service;

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final friends = await _service.getFriends();
      state = AsyncValue.data(friends);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> sendRequest(String recipientId) async {
    await _service.sendRequest(recipientId);
  }

  Future<void> removeFriend(String friendId) async {
    await _service.removeFriend(friendId);
    state = AsyncValue.data(
      (state.value ?? []).where((u) => u.id != friendId).toList(),
    );
  }

  Future<void> blockUser(String userId) async {
    await _service.blockUser(userId);
    // Remove from friends list after blocking
    state = AsyncValue.data(
      (state.value ?? []).where((u) => u.id != userId).toList(),
    );
  }
}

final friendsProvider = StateNotifierProvider<FriendsNotifier, AsyncValue<List<User>>>((ref) {
  return FriendsNotifier(ref.watch(friendsServiceProvider));
});

// Friend requests state
class FriendRequestsNotifier extends StateNotifier<AsyncValue<Map<String, List<FriendRequest>>>> {
  FriendRequestsNotifier(this._service) : super(const AsyncValue.loading()) {
    load();
  }

  final FriendsService _service;

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final requests = await _service.getRequests();
      state = AsyncValue.data(requests);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> accept(String requestId) async {
    await _service.acceptRequest(requestId);
    await load();
  }

  Future<void> reject(String requestId) async {
    await _service.rejectRequest(requestId);
    await load();
  }

  Future<void> cancel(String requestId) async {
    await _service.rejectRequest(requestId);
    await load();
  }
}

final friendRequestsProvider =
    StateNotifierProvider<FriendRequestsNotifier, AsyncValue<Map<String, List<FriendRequest>>>>((ref) {
  return FriendRequestsNotifier(ref.watch(friendsServiceProvider));
});
