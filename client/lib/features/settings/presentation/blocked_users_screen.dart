import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/api_provider.dart';
import '../../../core/services/friends_service.dart';
import '../../../core/models/user.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/empty_state.dart';

final blockedUsersProvider = FutureProvider<List<User>>((ref) async {
  final service = FriendsService(ref.watch(dioProvider));
  return service.getBlockedUsers();
});

class BlockedUsersScreen extends ConsumerWidget {
  const BlockedUsersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blockedUsersAsync = ref.watch(blockedUsersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Blocked Users')),
      body: blockedUsersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (blockedUsers) => blockedUsers.isEmpty
            ? const EmptyState(
                icon: Icons.block,
                title: 'No blocked users',
                message: 'You haven\'t blocked anyone yet.',
              )
            : ListView.builder(
                itemCount: blockedUsers.length,
                itemBuilder: (context, index) {
                  final user = blockedUsers[index];
                  return _BlockedUserTile(
                    user: user,
                    onUnblock: () async {
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          title: const Text('Unblock user'),
                          content: Text('Unblock ${user.displayName}?'),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(ctx, false),
                              child: const Text('Cancel'),
                            ),
                            FilledButton(
                              onPressed: () => Navigator.pop(ctx, true),
                              child: const Text('Unblock'),
                            ),
                          ],
                        ),
                      );
                      if (confirmed == true && context.mounted) {
                        final service = FriendsService(ref.read(dioProvider));
                        await service.unblockUser(user.id);
                        ref.invalidate(blockedUsersProvider);
                      }
                    },
                  );
                },
              ),
      ),
    );
  }
}

class _BlockedUserTile extends StatelessWidget {
  const _BlockedUserTile({
    required this.user,
    required this.onUnblock,
  });

  final User user;
  final VoidCallback onUnblock;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: AppColors.primaryContainer,
        child: user.avatarUrl != null
            ? ClipOval(child: Image.network(user.avatarUrl!, width: 40, height: 40, fit: BoxFit.cover))
            : Text(
                user.displayName[0].toUpperCase(),
                style: const TextStyle(color: AppColors.onPrimaryContainer),
              ),
      ),
      title: Text(user.displayName),
      subtitle: Text('@${user.username}'),
      trailing: TextButton(
        onPressed: onUnblock,
        child: const Text('Unblock', style: TextStyle(color: AppColors.primary)),
      ),
    );
  }
}
