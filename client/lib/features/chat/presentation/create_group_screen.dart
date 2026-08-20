import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/friends_provider.dart';
import '../../../core/providers/chat_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/user.dart';

class CreateGroupScreen extends ConsumerStatefulWidget {
  const CreateGroupScreen({super.key});

  @override
  ConsumerState<CreateGroupScreen> createState() => _CreateGroupScreenState();
}

class _CreateGroupScreenState extends ConsumerState<CreateGroupScreen> {
  final _nameController = TextEditingController();
  final Set<String> _selectedUserIds = {};
  bool _creating = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _createGroup() async {
    if (_selectedUserIds.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select at least one person')),
      );
      return;
    }

    setState(() => _creating = true);
    try {
      await ref.read(conversationsProvider.notifier).createConversation(
            _selectedUserIds.toList(),
            title: _nameController.text.trim().isNotEmpty ? _nameController.text.trim() : null,
          );
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create group: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final friendsAsync = ref.watch(friendsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('New group'),
        actions: [
          TextButton(
            onPressed: _creating ? null : _createGroup,
            child: _creating
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Create'),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _nameController,
              decoration: const InputDecoration(
                hintText: 'Group name (optional)',
                prefixIcon: Icon(Icons.group),
              ),
            ),
          ),
          if (_selectedUserIds.isNotEmpty)
            Container(
              height: 60,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: _selectedUserIds.map((id) {
                  final friends = friendsAsync.value ?? [];
                  final friend = friends.firstWhere(
                    (f) => f.id == id,
                    orElse: () => User(id: id, username: '', displayName: '?'),
                  );
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Chip(
                      avatar: CircleAvatar(
                        child: Text(friend.displayName[0].toUpperCase()),
                      ),
                      label: Text(friend.displayName),
                      deleteIcon: const Icon(Icons.close, size: 16),
                      onDeleted: () => setState(() => _selectedUserIds.remove(id)),
                    ),
                  );
                }).toList(),
              ),
            ),
          const Divider(),
          Expanded(
            child: friendsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
              data: (friends) {
                if (friends.isEmpty) {
                  return const Center(
                    child: Text('Add friends first to create a group'),
                  );
                }
                return ListView.builder(
                  itemCount: friends.length,
                  itemBuilder: (context, index) {
                    final friend = friends[index];
                    final isSelected = _selectedUserIds.contains(friend.id);
                    return CheckboxListTile(
                      value: isSelected,
                      onChanged: (v) {
                        setState(() {
                          if (v == true) {
                            _selectedUserIds.add(friend.id);
                          } else {
                            _selectedUserIds.remove(friend.id);
                          }
                        });
                      },
                      secondary: CircleAvatar(
                        backgroundColor: AppColors.primaryContainer,
                        child: friend.avatarUrl != null
                            ? ClipOval(child: Image.network(friend.avatarUrl!, width: 40, height: 40, fit: BoxFit.cover))
                            : Text(friend.displayName[0].toUpperCase(),
                                style: const TextStyle(color: AppColors.onPrimaryContainer)),
                      ),
                      title: Text(friend.displayName),
                      subtitle: Text('@${friend.username}'),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
