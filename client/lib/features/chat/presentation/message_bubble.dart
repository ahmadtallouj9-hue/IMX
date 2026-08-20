import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/models/chat_message.dart';

class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.message,
    required this.isMe,
    required this.showSender,
    this.isLast = false,
    this.onReply,
    this.onEdit,
    this.onDelete,
    this.onCopy,
    this.replyToMessage,
  });

  final ChatMessage message;
  final bool isMe;
  final bool showSender;
  final bool isLast;
  final VoidCallback? onReply;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onCopy;
  final ChatMessage? replyToMessage;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onSecondaryTapUp: (details) => _showContextMenu(context, details.globalPosition),
        onLongPress: () => _showContextMenu(context, null),
        child: Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.75),
          margin: EdgeInsets.only(
            left: isMe ? 64 : 16,
            right: isMe ? 16 : 64,
            top: showSender ? 8 : 2,
            bottom: isLast ? 12 : 2,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: isMe ? AppColors.primary : scheme.surface,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(18),
              topRight: const Radius.circular(18),
              bottomLeft: Radius.circular(isMe ? 18 : 4),
              bottomRight: Radius.circular(isMe ? 4 : 18),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (showSender && !isMe)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    message.sender.displayName,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              _buildContent(context),
              const SizedBox(height: 2),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _formatTime(message.createdAt),
                    style: TextStyle(
                      fontSize: 11,
                      color: isMe ? Colors.white.withValues(alpha: 0.7) : scheme.onSurfaceVariant,
                    ),
                  ),
                  if (isMe && message.readBy.isNotEmpty) ...[
                    const SizedBox(width: 4),
                    Icon(
                      Icons.done_all,
                      size: 14,
                      color: isMe ? Colors.white.withValues(alpha: 0.7) : AppColors.primary,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context) {
    switch (message.type) {
      case 'IMAGE':
        return _buildImageContent(context);
      case 'FILE':
        return _buildFileContent(context);
      case 'SYSTEM':
        return _buildSystemContent(context);
      default:
        return Text(
          message.body ?? '',
          style: TextStyle(
            fontSize: 15,
            color: isMe ? Colors.white : Theme.of(context).colorScheme.onSurface,
          ),
        );
    }
  }

  Widget _buildImageContent(BuildContext context) {
    final url = message.attachments.isNotEmpty ? message.attachments.first.url : (message.body ?? '');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: GestureDetector(
            onTap: () => _openImage(context, url),
            child: Image.network(
              url,
              width: 200,
              height: 200,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 200,
                height: 120,
                color: Colors.black.withValues(alpha: 0.1),
                child: const Icon(Icons.broken_image, size: 40),
              ),
            ),
          ),
        ),
        if (message.body != null && message.body!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              message.body!,
              style: TextStyle(
                fontSize: 14,
                color: isMe ? Colors.white : Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildFileContent(BuildContext context) {
    final attachment = message.attachments.isNotEmpty ? message.attachments.first : null;
    final url = attachment?.url ?? message.body ?? '';
    final fileName = attachment?.fileName ?? url.split('/').last;
    final fileSize = attachment?.displaySize ?? '';
    return GestureDetector(
      onTap: () => _launchUrl(url),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _getFileIcon(attachment?.mimeType),
              color: isMe ? Colors.white : AppColors.primary,
              size: 32,
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    fileName,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: isMe ? Colors.white : Theme.of(context).colorScheme.onSurface,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (fileSize.isNotEmpty)
                    Text(
                      fileSize,
                      style: TextStyle(
                        fontSize: 11,
                        color: isMe ? Colors.white.withValues(alpha: 0.7) : Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSystemContent(BuildContext context) {
    return Text(
      message.body ?? '',
      style: TextStyle(
        fontSize: 13,
        fontStyle: FontStyle.italic,
        color: isMe
            ? Colors.white.withValues(alpha: 0.7)
            : Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      textAlign: TextAlign.center,
    );
  }

  IconData _getFileIcon(String? mimeType) {
    if (mimeType == null) return Icons.insert_drive_file;
    if (mimeType.startsWith('video/')) return Icons.video_file;
    if (mimeType.startsWith('audio/')) return Icons.audio_file;
    if (mimeType.contains('pdf')) return Icons.picture_as_pdf;
    if (mimeType.contains('zip') || mimeType.contains('rar')) return Icons.folder_zip;
    return Icons.insert_drive_file;
  }

  void _showContextMenu(BuildContext context, Offset? position) {
    final items = <PopupMenuItem<String>>[];

    if (onReply != null) {
      items.add(const PopupMenuItem(value: 'reply', child: Text('Reply')));
    }
    items.add(const PopupMenuItem(value: 'copy', child: Text('Copy')));
    if (isMe && onEdit != null && message.type == 'TEXT') {
      items.add(const PopupMenuItem(value: 'edit', child: Text('Edit')));
    }
    if (isMe && onDelete != null) {
      items.add(PopupMenuItem(
        value: 'delete',
        child: Text('Delete', style: TextStyle(color: Theme.of(context).colorScheme.error)),
      ));
    }

    if (items.isEmpty) return;

    if (position != null) {
      showMenu<String>(
        context: context,
        position: RelativeRect.fromLTRB(
          position.dx,
          position.dy,
          position.dx + 1,
          position.dy + 1,
        ),
        items: items,
      ).then((value) => _handleMenuAction(value));
    } else {
      showModalBottomSheet(
        context: context,
        builder: (ctx) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: items.map((item) => ListTile(
              title: item.child,
              onTap: () {
                Navigator.pop(ctx);
                _handleMenuAction(item.value);
              },
            )).toList(),
          ),
        ),
      );
    }
  }

  void _handleMenuAction(String? action) {
    switch (action) {
      case 'reply':
        onReply?.call();
        break;
      case 'copy':
        final text = message.body ?? '';
        if (text.isNotEmpty) {
          Clipboard.setData(ClipboardData(text: text));
        } else if (message.attachments.isNotEmpty) {
          Clipboard.setData(ClipboardData(text: message.attachments.first.url));
        }
        onCopy?.call();
        break;
      case 'edit':
        onEdit?.call();
        break;
      case 'delete':
        onDelete?.call();
        break;
    }
  }

  void _openImage(BuildContext context, String url) {
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => _FullScreenImage(url: url),
    ));
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  String _formatTime(DateTime dateTime) {
    final h = dateTime.hour.toString().padLeft(2, '0');
    final m = dateTime.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

class _FullScreenImage extends StatelessWidget {
  const _FullScreenImage({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: InteractiveViewer(
          child: Image.network(
            url,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const Center(
              child: Icon(Icons.broken_image, color: Colors.white, size: 64),
            ),
          ),
        ),
      ),
    );
  }
}
