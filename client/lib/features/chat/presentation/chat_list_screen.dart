import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/providers/chat_provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/conversation.dart';
import 'create_group_screen.dart';

class ChatListScreen extends ConsumerWidget {
  const ChatListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversationsAsync = ref.watch(conversationsProvider);
    final currentUser = ref.watch(authProvider).user;

    ref.listen(authProvider, (prev, next) async {
      if (next.status == AuthStatus.authenticated) {
        final tokenStorage = ref.read(tokenStorageProvider);
        final token = await tokenStorage.getAccessToken();
        if (token != null) {
          final socket = ref.read(chatSocketProvider);
          if (!socket.isConnected) {
            socket.connect(token);
          }
        }
      }
    });

    ref.listen(chatSocketProvider, (prev, next) {
      next.onMessage.listen((message) {
        ref.read(conversationsProvider.notifier).updateLastMessage(message);
      });
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chats'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => context.push('/search'),
            tooltip: 'Search messages',
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.add),
            onSelected: (value) {
              if (value == 'new_chat') {
                context.push('/new-chat');
              } else if (value == 'new_group') {
                Navigator.push(context, MaterialPageRoute(
                  builder: (_) => const CreateGroupScreen(),
                ));
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'new_chat', child: Text('New conversation')),
              const PopupMenuItem(value: 'new_group', child: Text('New group')),
            ],
          ),
        ],
      ),
      body: conversationsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.error),
              const SizedBox(height: 16),
              Text('Failed to load chats'),
              const SizedBox(height: 8),
              FilledButton.tonal(
                onPressed: () => ref.read(conversationsProvider.notifier).load(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (conversations) => conversations.isEmpty
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.forum_outlined, size: 48, color: AppColors.offline),
                      const SizedBox(height: 16),
                      const Text('No conversations yet', style: TextStyle(fontSize: 16)),
                      const SizedBox(height: 4),
                      const Text('Start a conversation from the Friends tab', textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      FilledButton.tonal(
                        onPressed: () => context.push('/new-chat'),
                        child: const Text('Start chatting'),
                      ),
                    ],
                  ),
                ),
              )
            : RefreshIndicator(
                onRefresh: () async => ref.read(conversationsProvider.notifier).load(),
                child: ListView.builder(
                  itemCount: conversations.length,
                  itemBuilder: (context, index) {
                    final conv = conversations[index];
                    return _ConversationTile(
                      conversation: conv,
                      currentUserId: currentUser?.id ?? '',
                    );
                  },
                ),
              ),
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({required this.conversation, required this.currentUserId});

  final Conversation conversation;
  final String currentUserId;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final otherMembers = conversation.members.where((m) => m.id != currentUserId).toList();
    final displayName = conversation.title ?? (otherMembers.isNotEmpty ? otherMembers[0].displayName : 'Unknown');
    final avatarUrl = conversation.type == 'DIRECT' && otherMembers.isNotEmpty
        ? otherMembers[0].avatarUrl
        : conversation.imageUrl;
    final isOnline = conversation.type == 'DIRECT' && otherMembers.isNotEmpty && otherMembers[0].isOnline;

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Stack(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: AppColors.primaryContainer,
            child: avatarUrl != null
                ? ClipOval(child: Image.network(avatarUrl, width: 48, height: 48, fit: BoxFit.cover))
                : Text(displayName[0].toUpperCase(),
                    style: const TextStyle(color: AppColors.onPrimaryContainer, fontSize: 18)),
          ),
          if (isOnline)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: AppColors.online,
                  shape: BoxShape.circle,
                  border: Border.all(color: scheme.surface, width: 2),
                ),
              ),
            ),
        ],
      ),
      title: Text(displayName, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: conversation.lastMessage != null
          ? Text(
              '${conversation.lastMessage!.senderName}: ${conversation.lastMessage!.body}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: scheme.onSurfaceVariant),
            )
          : null,
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            _formatTime(conversation.lastMessageAt),
            style: TextStyle(
              fontSize: 12,
              color: conversation.unreadCount > 0 ? AppColors.primary : scheme.onSurfaceVariant,
            ),
          ),
          if (conversation.unreadCount > 0) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '${conversation.unreadCount}',
                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ],
      ),
      onTap: () {
        context.push('/chat/${conversation.id}');
      },
    );
  }

  String _formatTime(DateTime dateTime) {
    final now = DateTime.now();
    final diff = now.difference(dateTime);
    if (diff.inDays == 0) return DateFormat.Hm().format(dateTime);
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return DateFormat.E().format(dateTime);
    return DateFormat.MMMd().format(dateTime);
  }
}
