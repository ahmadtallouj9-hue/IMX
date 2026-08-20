import 'user.dart';

class ChatMessage {
  const ChatMessage({
    required this.id,
    this.clientMessageId,
    this.body,
    required this.type,
    required this.sender,
    this.replyToId,
    required this.createdAt,
    this.readBy = const [],
    this.conversationId,
    this.attachments = const [],
  });

  final String id;
  final String? clientMessageId;
  final String? body;
  final String type;
  final User sender;
  final String? replyToId;
  final DateTime createdAt;
  final List<ReadReceipt> readBy;
  final String? conversationId;
  final List<Attachment> attachments;

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String,
      clientMessageId: json['clientMessageId'] as String?,
      body: json['body'] as String?,
      type: json['type'] as String? ?? 'TEXT',
      sender: User.fromJson(json['sender'] as Map<String, dynamic>),
      replyToId: json['replyToId'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      readBy: (json['readBy'] as List<dynamic>? ?? [])
          .map((r) => ReadReceipt.fromJson(r as Map<String, dynamic>))
          .toList(),
      conversationId: json['conversationId'] as String?,
      attachments: (json['attachments'] as List<dynamic>? ?? [])
          .map((a) => Attachment.fromJson(a as Map<String, dynamic>))
          .toList(),
    );
  }
}

class Attachment {
  const Attachment({
    required this.id,
    required this.kind,
    required this.url,
    this.mimeType,
    this.size,
    this.fileName,
    this.width,
    this.height,
  });

  final String id;
  final String kind;
  final String url;
  final String? mimeType;
  final int? size;
  final String? fileName;
  final int? width;
  final int? height;

  factory Attachment.fromJson(Map<String, dynamic> json) {
    return Attachment(
      id: json['id'] as String,
      kind: json['kind'] as String,
      url: json['url'] as String,
      mimeType: json['mimeType'] as String?,
      size: json['size'] as int?,
      fileName: json['fileName'] as String?,
      width: json['width'] as int?,
      height: json['height'] as int?,
    );
  }

  bool get isImage => kind == 'image';
  bool get isFile => kind == 'file';

  String get displaySize {
    if (size == null) return '';
    if (size! < 1024) return '$size B';
    if (size! < 1024 * 1024) return '${(size! / 1024).toStringAsFixed(1)} KB';
    return '${(size! / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  String get displayType {
    if (mimeType != null) {
      final parts = mimeType!.split('/');
      if (parts.length > 1) return parts[1].toUpperCase();
    }
    final ext = fileName?.split('.').last;
    if (ext != null) return ext.toUpperCase();
    return kind.toUpperCase();
  }
}

class ReadReceipt {
  const ReadReceipt({required this.userId, required this.readAt});

  final String userId;
  final DateTime readAt;

  factory ReadReceipt.fromJson(Map<String, dynamic> json) {
    return ReadReceipt(
      userId: json['userId'] as String,
      readAt: DateTime.parse(json['readAt'] as String),
    );
  }
}
