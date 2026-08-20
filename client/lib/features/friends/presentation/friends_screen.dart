import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/friends_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/user.dart';
import '../../../core/models/friend_request.dart';
import 'search_users_screen.dart';

class FriendsScreen extends ConsumerStatefulWidget {
  const FriendsScreen({super.key});

  @override
  ConsumerState<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends ConsumerState<FriendsScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final friendsAsync = ref.watch(friendsProvider);
    final requestsAsync = ref.watch(friendRequestsProvider);
    final requestCount = requestsAsync.value?['received']?.length ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Friends'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_search),
            onPressed: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const SearchUsersScreen()));
            },
            tooltip: 'Find people',
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            const Tab(text: 'Friends'),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Requests'),
                  if (requestCount > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text('$requestCount', style: const TextStyle(color: Colors.white, fontSize: 12)),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Friends tab
          friendsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e')),
            data: (friends) => friends.isEmpty
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.people_outline, size: 48, color: AppColors.offline),
                          SizedBox(height: 16),
                          Text('No friends yet', style: TextStyle(fontSize: 16)),
                          SizedBox(height: 4),
                          Text('Search for people to add as friends', textAlign: TextAlign.center),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: () async => ref.read(friendsProvider.notifier).load(),
                    child: ListView.builder(
                      itemCount: friends.length,
                      itemBuilder: (context, index) => _FriendTile(friend: friends[index]),
                    ),
                  ),
          ),

          // Requests tab
          requestsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e')),
            data: (requests) {
              final received = requests['received'] ?? [];
              final sent = requests['sent'] ?? [];
              if (received.isEmpty && sent.isEmpty) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.person_add_disabled_outlined, size: 48, color: AppColors.offline),
                        SizedBox(height: 16),
                        Text('No pending requests', style: TextStyle(fontSize: 16)),
                      ],
                    ),
                  ),
                );
              }
              return RefreshIndicator(
                onRefresh: () async => ref.read(friendRequestsProvider.notifier).load(),
                child: ListView(
                  children: [
                    if (received.isNotEmpty) ...[
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                        child: Text('Received', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary)),
                      ),
                      for (final req in received)
                        _ReceivedRequestTile(request: req),
                    ],
                    if (sent.isNotEmpty) ...[
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                        child: Text('Sent', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.secondary)),
                      ),
                      for (final req in sent)
                        _SentRequestTile(request: req),
                    ],
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _FriendTile extends ConsumerWidget {
  const _FriendTile({required this.friend});

  final User friend;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: AppColors.primaryContainer,
        child: friend.avatarUrl != null
            ? ClipOval(child: Image.network(friend.avatarUrl!, width: 40, height: 40, fit: BoxFit.cover))
            : Text(friend.displayName[0].toUpperCase(),
                style: const TextStyle(color: AppColors.onPrimaryContainer)),
      ),
      title: Text(friend.displayName),
      subtitle: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: friend.isOnline ? AppColors.online : AppColors.offline,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(friend.isOnline ? 'Online' : 'Offline',
              style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)),
        ],
      ),
      trailing: PopupMenuButton<String>(
        onSelected: (value) async {
          if (value == 'remove') {
            final confirmed = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Remove friend'),
                content: Text('Remove ${friend.displayName} from your friends?'),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                  FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove')),
                ],
              ),
            );
            if (confirmed == true && context.mounted) {
              ref.read(friendsProvider.notifier).removeFriend(friend.id);
            }
          } else if (value == 'block') {
            final confirmed = await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Block user'),
                content: Text('Block ${friend.displayName}? They won\'t be able to send you messages or friend requests.'),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                  FilledButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    style: FilledButton.styleFrom(backgroundColor: Colors.red),
                    child: const Text('Block'),
                  ),
                ],
              ),
            );
            if (confirmed == true && context.mounted) {
              ref.read(friendsProvider.notifier).blockUser(friend.id);
            }
          }
        },
        itemBuilder: (context) => [
          const PopupMenuItem(value: 'remove', child: Text('Remove friend')),
          const PopupMenuItem(value: 'block', child: Text('Block user', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
  }
}

class _ReceivedRequestTile extends ConsumerWidget {
  const _ReceivedRequestTile({required this.request});

  final FriendRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = request.user;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: AppColors.primaryContainer,
        child: user.avatarUrl != null
            ? ClipOval(child: Image.network(user.avatarUrl!, width: 40, height: 40, fit: BoxFit.cover))
            : Text(user.displayName[0].toUpperCase(),
                style: const TextStyle(color: AppColors.onPrimaryContainer)),
      ),
      title: Text(user.displayName),
      subtitle: Text('@${user.username}'),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            icon: const Icon(Icons.check_circle, color: AppColors.online),
            onPressed: () => ref.read(friendRequestsProvider.notifier).accept(request.id),
            tooltip: 'Accept',
          ),
          IconButton(
            icon: const Icon(Icons.cancel, color: AppColors.error),
            onPressed: () => ref.read(friendRequestsProvider.notifier).reject(request.id),
            tooltip: 'Reject',
          ),
        ],
      ),
    );
  }
}

class _SentRequestTile extends ConsumerWidget {
  const _SentRequestTile({required this.request});

  final FriendRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = request.user;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: AppColors.secondaryContainer,
        child: user.avatarUrl != null
            ? ClipOval(child: Image.network(user.avatarUrl!, width: 40, height: 40, fit: BoxFit.cover))
            : Text(user.displayName[0].toUpperCase(),
                style: const TextStyle(color: AppColors.onSecondaryContainer)),
      ),
      title: Text(user.displayName),
      subtitle: const Text('Request pending'),
      trailing: TextButton(
        onPressed: () => ref.read(friendRequestsProvider.notifier).cancel(request.id),
        child: const Text('Cancel', style: TextStyle(color: AppColors.error)),
      ),
    );
  }
}
