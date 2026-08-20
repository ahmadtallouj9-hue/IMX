import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/friends_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/user.dart';

class SearchUsersScreen extends ConsumerStatefulWidget {
  const SearchUsersScreen({super.key});

  @override
  ConsumerState<SearchUsersScreen> createState() => _SearchUsersScreenState();
}

class _SearchUsersScreenState extends ConsumerState<SearchUsersScreen> {
  final _searchController = TextEditingController();
  final _debounceSearch = _Debouncer();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final searchState = ref.watch(searchProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Find people'),
        actions: [
          IconButton(
            icon: const Icon(Icons.close),
            onPressed: () {
              ref.read(searchProvider.notifier).clear();
              Navigator.pop(context);
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'Search by username or name...',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (value) {
                _debounceSearch.run(() {
                  ref.read(searchProvider.notifier).search(value);
                });
              },
            ),
          ),
          Expanded(
            child: searchState.loading
                ? const Center(child: CircularProgressIndicator())
                : searchState.query.length < 2
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(32),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.search, size: 48, color: AppColors.offline),
                              SizedBox(height: 16),
                              Text('Type at least 2 characters to search'),
                            ],
                          ),
                        ),
                      )
                    : searchState.results.isEmpty
                        ? const Center(
                            child: Padding(
                              padding: EdgeInsets.all(32),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.person_search, size: 48, color: AppColors.offline),
                                  SizedBox(height: 16),
                                  Text('No users found'),
                                ],
                              ),
                            ),
                          )
                        : ListView.builder(
                            itemCount: searchState.results.length,
                            itemBuilder: (context, index) {
                              return _UserTile(user: searchState.results[index]);
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

class _UserTile extends ConsumerWidget {
  const _UserTile({required this.user});

  final User user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: AppColors.primaryContainer,
        child: user.avatarUrl != null
            ? ClipOval(child: Image.network(user.avatarUrl!, width: 40, height: 40, fit: BoxFit.cover))
            : Text(user.displayName[0].toUpperCase(), style: const TextStyle(color: AppColors.onPrimaryContainer)),
      ),
      title: Text(user.displayName),
      subtitle: Text('@${user.username}', style: TextStyle(color: scheme.onSurfaceVariant)),
      trailing: FilledButton.tonal(
        onPressed: () async {
          try {
            await ref.read(friendsProvider.notifier).sendRequest(user.id);
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Friend request sent to ${user.displayName}')),
              );
            }
          } catch (e) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: const Text('Failed to send request'), backgroundColor: scheme.error),
              );
            }
          }
        },
        child: const Text('Add'),
      ),
    );
  }
}

class _Debouncer {
  Duration delay = const Duration(milliseconds: 400);
  dynamic _timer;

  void run(VoidCallback action) {
    _timer?.cancel();
    _timer = Future.delayed(delay, action);
  }
}
