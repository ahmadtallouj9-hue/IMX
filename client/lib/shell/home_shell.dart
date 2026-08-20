import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/providers/auth_provider.dart';
import '../core/providers/notification_provider.dart';
import '../core/theme/app_theme.dart';
import '../features/chat/presentation/chat_list_screen.dart';
import '../features/friends/presentation/friends_screen.dart';
import '../features/notifications/presentation/notifications_screen.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/settings/presentation/settings_screen.dart';

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key, this.child});

  final Widget? child;

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _selectedIndex = 0;

  static const double _wideBreakpoint = 900;

  static const List<({String label, IconData icon, IconData selectedIcon, Widget screen})>
      _destinations = [
    (label: 'Chats', icon: Icons.forum_outlined, selectedIcon: Icons.forum, screen: ChatListScreen()),
    (label: 'Friends', icon: Icons.people_outline, selectedIcon: Icons.people, screen: FriendsScreen()),
    (label: 'Notifications', icon: Icons.notifications_outlined, selectedIcon: Icons.notifications, screen: NotificationsScreen()),
    (label: 'Profile', icon: Icons.person_outline, selectedIcon: Icons.person, screen: ProfileScreen()),
    (label: 'Settings', icon: Icons.settings_outlined, selectedIcon: Icons.settings, screen: SettingsScreen()),
  ];

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.sizeOf(context).width >= _wideBreakpoint;
    final screen = _destinations[_selectedIndex].screen;
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final unreadCount = ref.watch(unreadNotificationCountProvider);

    if (isWide) {
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: _selectedIndex,
              onDestinationSelected: (i) => setState(() => _selectedIndex = i),
              labelType: NavigationRailLabelType.all,
              leading: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: AppColors.primaryContainer,
                      child: user?.avatarUrl != null
                          ? ClipOval(child: Image.network(user!.avatarUrl!, width: 40, height: 40, fit: BoxFit.cover))
                          : Text(
                              (user?.displayName ?? user?.username ?? '?')[0].toUpperCase(),
                              style: const TextStyle(color: AppColors.onPrimaryContainer, fontWeight: FontWeight.bold),
                            ),
                    ),
                    const SizedBox(height: 4),
                    IconButton(
                      icon: const Icon(Icons.logout, size: 20),
                      onPressed: () => _confirmLogout(context),
                      tooltip: 'Sign out',
                    ),
                  ],
                ),
              ),
              destinations: [
                for (final d in _destinations)
                  NavigationRailDestination(icon: Icon(d.icon), selectedIcon: Icon(d.selectedIcon), label: Text(d.label)),
              ],
            ),
            const VerticalDivider(thickness: 1, width: 1),
            Expanded(child: screen),
          ],
        ),
      );
    }

    return Scaffold(
      body: screen,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (i) => setState(() => _selectedIndex = i),
        destinations: [
          NavigationDestination(icon: Icon(_destinations[0].icon), selectedIcon: Icon(_destinations[0].selectedIcon), label: _destinations[0].label),
          NavigationDestination(icon: Icon(_destinations[1].icon), selectedIcon: Icon(_destinations[1].selectedIcon), label: _destinations[1].label),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: unreadCount > 0,
              label: Text('$unreadCount', style: const TextStyle(fontSize: 10, color: Colors.white)),
              child: Icon(_destinations[2].icon),
            ),
            selectedIcon: Badge(
              isLabelVisible: unreadCount > 0,
              label: Text('$unreadCount', style: const TextStyle(fontSize: 10, color: Colors.white)),
              child: Icon(_destinations[2].selectedIcon),
            ),
            label: _destinations[2].label,
          ),
          NavigationDestination(icon: Icon(_destinations[3].icon), selectedIcon: Icon(_destinations[3].selectedIcon), label: _destinations[3].label),
          NavigationDestination(icon: Icon(_destinations[4].icon), selectedIcon: Icon(_destinations[4].selectedIcon), label: _destinations[4].label),
        ],
      ),
    );
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(authProvider.notifier).logout();
            },
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}
