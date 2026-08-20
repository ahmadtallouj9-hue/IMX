import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/providers/chat_provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/chat_message.dart';
import 'message_bubble.dart';

class ConversationScreen extends ConsumerStatefulWidget {
  const ConversationScreen({super.key, required this.conversationId});

  final String conversationId;

  @override
  ConsumerState<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final _uuid = const Uuid();
  final _imagePicker = ImagePicker();
  Timer? _typingTimer;
  bool _isUploading = false;
  double _uploadProgress = 0;
  ChatMessage? _replyToMessage;
  ChatMessage? _editingMessage;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _typingTimer?.cancel();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      ref.read(messagesProvider(widget.conversationId).notifier).loadMore();
    }
  }

  void _sendMessage({List<Map<String, dynamic>>? attachments}) {
    if (_editingMessage != null) {
      _editMessage(_messageController.text.trim());
      return;
    }

    final text = _messageController.text.trim();
    if (text.isEmpty && (attachments == null || attachments.isEmpty)) return;

    final clientMessageId = _uuid.v4();
    _messageController.clear();
    setState(() => _replyToMessage = null);
    _stopTyping();
    () async {
      try {
        final sent = await ref.read(chatServiceProvider).sendMessage(
          widget.conversationId,
          body: text.isNotEmpty ? text : null,
          clientMessageId: clientMessageId,
          attachments: attachments,
        );
        if (!mounted) return;
        ref.read(messagesProvider(widget.conversationId).notifier).addMessage(sent);
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not send: $e')),
        );
      }
    }();
  }

  void _onTextChanged(String text) {
    final socket = ref.read(chatSocketProvider);
    socket.startTyping(widget.conversationId);
    _typingTimer?.cancel();
    _typingTimer = Timer(const Duration(seconds: 2), () {
      socket.stopTyping(widget.conversationId);
    });
  }

  void _stopTyping() {
    _typingTimer?.cancel();
    ref.read(chatSocketProvider).stopTyping(widget.conversationId);
  }

  void _startReply(ChatMessage message) {
    setState(() => _replyToMessage = message);
    _messageController.clear();
    _messageController.text = '';
  }

  void _startEdit(ChatMessage message) {
    setState(() => _editingMessage = message);
    _messageController.text = message.body ?? '';
    _messageController.selection = TextSelection.fromPosition(
      TextPosition(offset: _messageController.text.length),
    );
  }

  void _cancelReplyOrEdit() {
    setState(() {
      _replyToMessage = null;
      _editingMessage = null;
    });
    _messageController.clear();
  }

  Future<void> _deleteMessage(ChatMessage message) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete message'),
        content: const Text('Are you sure you want to delete this message?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      try {
        final chatService = ref.read(chatServiceProvider);
        await chatService.deleteMessage(widget.conversationId, message.id);
        ref.read(messagesProvider(widget.conversationId).notifier).removeMessage(message.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Message deleted')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to delete: $e'), backgroundColor: Theme.of(context).colorScheme.error),
          );
        }
      }
    }
  }

  Future<void> _editMessage(String newBody) async {
    if (_editingMessage == null || newBody.trim().isEmpty) return;
    try {
      final chatService = ref.read(chatServiceProvider);
      await chatService.editMessage(widget.conversationId, _editingMessage!.id, newBody.trim());
      ref.read(messagesProvider(widget.conversationId).notifier).updateMessage(_editingMessage!.id, newBody.trim());
      setState(() => _editingMessage = null);
      _messageController.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Message edited')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to edit: $e'), backgroundColor: Theme.of(context).colorScheme.error),
        );
      }
    }
  }

  Future<void> _pickImage() async {
    final picked = await _imagePicker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;
    await _uploadAndSendFile(File(picked.path), picked.name);
  }

  Future<void> _takePhoto() async {
    final picked = await _imagePicker.pickImage(source: ImageSource.camera, imageQuality: 85);
    if (picked == null) return;
    await _uploadAndSendFile(File(picked.path), picked.name);
  }

  Future<void> _pickFile() async {
    final picked = await _imagePicker.pickMedia();
    if (picked == null) return;
    await _uploadAndSendFile(File(picked.path), picked.name);
  }

  Future<void> _uploadAndSendFile(File file, String fileName) async {
    setState(() {
      _isUploading = true;
      _uploadProgress = 0;
    });

    try {
      final chatService = ref.read(chatServiceProvider);
      final result = await chatService.uploadFile(file, onProgress: (sent, total) {
        setState(() {
          _uploadProgress = total > 0 ? sent / total : 0;
        });
      });

      final isImage = fileName.toLowerCase().endsWith('.jpg') ||
          fileName.toLowerCase().endsWith('.jpeg') ||
          fileName.toLowerCase().endsWith('.png') ||
          fileName.toLowerCase().endsWith('.gif') ||
          fileName.toLowerCase().endsWith('.webp');

      _sendMessage(attachments: [
        {
          'url': result['url'] as String,
          'kind': isImage ? 'image' : 'file',
          'mimeType': result['mimeType'] as String?,
          'size': result['size'] as int?,
          'fileName': fileName,
        },
      ]);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upload failed: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      setState(() {
        _isUploading = false;
        _uploadProgress = 0;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final messagesAsync = ref.watch(messagesProvider(widget.conversationId));
    final currentUser = ref.watch(authProvider).user;
    final typingUsers = ref.watch(typingProvider(widget.conversationId));
    ref.listen(chatSocketProvider, (prev, next) {
      next.onMessage.listen((message) {
        if (message.conversationId == widget.conversationId) {
          ref.read(messagesProvider(widget.conversationId).notifier).addMessage(message);
        }
      });
      next.onMessageEdited.listen((data) {
        if (data['conversationId'] == widget.conversationId) {
          ref.read(messagesProvider(widget.conversationId).notifier).updateMessage(
                data['id'] as String,
                data['body'] as String,
              );
        }
      });
      next.onMessageDeleted.listen((data) {
        if (data['conversationId'] == widget.conversationId) {
          ref.read(messagesProvider(widget.conversationId).notifier).removeMessage(
                data['id'] as String,
              );
        }
      });
      next.onRead.listen((data) {
        if (data['conversationId'] == widget.conversationId) {
          ref.read(messagesProvider(widget.conversationId).notifier).updateReadBy(
                data['messageId'] as String,
                data['userId'] as String,
                DateTime.parse(data['readAt'] as String),
              );
        }
      });
    });

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        title: const Text('Chat'),
      ),
      body: Column(
        children: [
          Expanded(
            child: messagesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
              data: (messages) {
                if (messages.isEmpty) {
                  return const Center(child: Text('Send a message to start the conversation'));
                }
                return ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final msg = messages[index];
                    final isMe = msg.sender.id == currentUser?.id;
                    final showSender = index == 0 || messages[index - 1].sender.id != msg.sender.id;
                    final isLast = index == messages.length - 1 || messages[index + 1].sender.id != msg.sender.id;
                    return MessageBubble(
                      message: msg,
                      isMe: isMe,
                      showSender: showSender,
                      isLast: isLast,
                      onReply: () => _startReply(msg),
                      onEdit: isMe ? () => _startEdit(msg) : null,
                      onDelete: isMe ? () => _deleteMessage(msg) : null,
                      onCopy: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Copied to clipboard')),
                        );
                      },
                    );
                  },
                );
              },
            ),
          ),
          if (_isUploading)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('Uploading...', style: TextStyle(fontSize: 13)),
                        const SizedBox(height: 4),
                        LinearProgressIndicator(
                          value: _uploadProgress,
                          backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          if (typingUsers.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Row(
                children: [
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${typingUsers.values.first} is typing...',
                    style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          if (_replyToMessage != null || _editingMessage != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                border: Border(
                  left: BorderSide(
                    color: _editingMessage != null ? AppColors.secondary : AppColors.primary,
                    width: 3,
                  ),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _editingMessage != null ? Icons.edit : Icons.reply,
                    size: 18,
                    color: _editingMessage != null ? AppColors.secondary : AppColors.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _editingMessage != null ? 'Editing message' : 'Replying to ${_replyToMessage!.sender.displayName}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: _editingMessage != null ? AppColors.secondary : AppColors.primary,
                          ),
                        ),
                        Text(
                          (_editingMessage?.body ?? _replyToMessage?.body ?? '').replaceAll('\n', ' '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: _cancelReplyOrEdit,
                  ),
                ],
              ),
            ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4, offset: Offset(0, -1))],
            ),
            child: SafeArea(
              child: Row(
                children: [
                  IconButton(
                    onPressed: _isUploading ? null : _showAttachMenu,
                    icon: const Icon(Icons.attach_file),
                    color: AppColors.primary,
                  ),
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      decoration: InputDecoration(
                        hintText: _editingMessage != null ? 'Edit message...' : 'Type a message...',
                        border: InputBorder.none,
                      ),
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
                      onChanged: _onTextChanged,
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: _isUploading ? null : _sendMessage,
                    icon: const Icon(Icons.send),
                    color: AppColors.primary,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showAttachMenu() {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.photo, color: AppColors.primary),
                title: const Text('Gallery'),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickImage();
                },
              ),
              ListTile(
                leading: const Icon(Icons.camera_alt, color: AppColors.primary),
                title: const Text('Camera'),
                onTap: () {
                  Navigator.pop(ctx);
                  _takePhoto();
                },
              ),
              ListTile(
                leading: const Icon(Icons.insert_drive_file, color: AppColors.primary),
                title: const Text('File'),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickFile();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
