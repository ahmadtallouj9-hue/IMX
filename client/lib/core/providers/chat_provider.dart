import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/conversation.dart';
import '../models/chat_message.dart';
import '../services/chat_service.dart';
import '../network/chat_socket.dart';
import 'api_provider.dart';

// Chat service provider
final chatServiceProvider = Provider<ChatService>((ref) {
  return ChatService(ref.watch(dioProvider));
});

// Chat socket singleton
final chatSocketProvider = Provider<ChatSocket>((ref) {
  final socket = ChatSocket();
  ref.onDispose(() => socket.dispose());
  return socket;
});

// Conversations list
class ConversationsNotifier extends StateNotifier<AsyncValue<List<Conversation>>> {
  ConversationsNotifier(this._service) : super(const AsyncValue.loading()) {
    load();
  }

  final ChatService _service;

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final conversations = await _service.getConversations();
      state = AsyncValue.data(conversations);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<String> createConversation(List<String> participantIds, {String? title}) async {
    final id = await _service.createConversation(participantIds, title: title);
    await load();
    return id;
  }

  void updateLastMessage(ChatMessage message) {
    final current = state.value;
    if (current == null) return;

    final updated = current.map((c) {
      if (c.id == message.conversationId) {
        return Conversation(
          id: c.id,
          type: c.type,
          title: c.title,
          imageUrl: c.imageUrl,
          members: c.members,
          lastMessage: LastMessage(
            body: message.body ?? '',
            senderName: message.sender.displayName,
            createdAt: message.createdAt,
          ),
          lastMessageAt: message.createdAt,
          unreadCount: c.unreadCount + 1,
        );
      }
      return c;
    }).toList();

    // Sort by lastMessageAt descending
    updated.sort((a, b) => b.lastMessageAt.compareTo(a.lastMessageAt));
    state = AsyncValue.data(updated);
  }
}

final conversationsProvider =
    StateNotifierProvider<ConversationsNotifier, AsyncValue<List<Conversation>>>((ref) {
  return ConversationsNotifier(ref.watch(chatServiceProvider));
});

// Messages for a specific conversation
class MessagesNotifier extends StateNotifier<AsyncValue<List<ChatMessage>>> {
  MessagesNotifier(this._service, this._conversationId) : super(const AsyncValue.loading()) {
    load();
  }

  final ChatService _service;
  final String _conversationId;
  String? _nextCursor;
  bool _hasMore = true;

  bool get hasMore => _hasMore;

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.getMessages(_conversationId);
      final messages = result['messages'] as List<ChatMessage>;
      _nextCursor = result['nextCursor'] as String?;
      _hasMore = result['hasMore'] as bool;
      // Messages come in desc order, reverse for display
      state = AsyncValue.data(messages.reversed.toList());
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> loadMore() async {
    if (!_hasMore || _nextCursor == null) return;
    try {
      final result = await _service.getMessages(_conversationId, cursor: _nextCursor);
      final messages = result['messages'] as List<ChatMessage>;
      _nextCursor = result['nextCursor'] as String?;
      _hasMore = result['hasMore'] as bool;
      final current = state.value ?? [];
      state = AsyncValue.data([...messages.reversed, ...current]);
    } catch (_) {}
  }

  void addMessage(ChatMessage message) {
    final current = state.value ?? [];
    // Avoid duplicates
    if (current.any((m) => m.id == message.id)) return;
    state = AsyncValue.data([...current, message]);
  }

  void updateReadBy(String messageId, String userId, DateTime readAt) {
    final current = state.value;
    if (current == null) return;
    state = AsyncValue.data(current.map((m) {
      if (m.id == messageId && !m.readBy.any((r) => r.userId == userId)) {
        return ChatMessage(
          id: m.id,
          clientMessageId: m.clientMessageId,
          body: m.body,
          type: m.type,
          sender: m.sender,
          replyToId: m.replyToId,
          createdAt: m.createdAt,
          readBy: [...m.readBy, ReadReceipt(userId: userId, readAt: readAt)],
        );
      }
      return m;
    }).toList());
  }

  void removeMessage(String messageId) {
    final current = state.value;
    if (current == null) return;
    state = AsyncValue.data(current.where((m) => m.id != messageId).toList());
  }

  void updateMessage(String messageId, String newBody) {
    final current = state.value;
    if (current == null) return;
    state = AsyncValue.data(current.map((m) {
      if (m.id == messageId) {
        return ChatMessage(
          id: m.id,
          clientMessageId: m.clientMessageId,
          body: newBody,
          type: m.type,
          sender: m.sender,
          replyToId: m.replyToId,
          createdAt: m.createdAt,
          readBy: m.readBy,
          attachments: m.attachments,
        );
      }
      return m;
    }).toList());
  }
}

final messagesProvider = StateNotifierProvider.family<MessagesNotifier, AsyncValue<List<ChatMessage>>, String>(
  (ref, conversationId) {
    return MessagesNotifier(ref.watch(chatServiceProvider), conversationId);
  },
);

// Typing indicators for a conversation
class TypingNotifier extends StateNotifier<Map<String, String>> {
  TypingNotifier() : super({});

  void setTyping(String userId, String displayName) {
    state = {...state, userId: displayName};
  }

  void clearTyping(String userId) {
    final updated = Map<String, String>.from(state);
    updated.remove(userId);
    state = updated;
  }
}

final typingProvider = StateNotifierProvider.family<TypingNotifier, Map<String, String>, String>(
  (ref, conversationId) => TypingNotifier(),
);
