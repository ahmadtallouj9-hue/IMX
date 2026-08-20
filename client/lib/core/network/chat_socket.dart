import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../constants/app_constants.dart';
import '../models/chat_message.dart';

class ChatSocket {
  io.Socket? _socket;
  final _messageController = StreamController<ChatMessage>.broadcast();
  final _messageEditedController = StreamController<Map<String, dynamic>>.broadcast();
  final _messageDeletedController = StreamController<Map<String, dynamic>>.broadcast();
  final _typingStartController = StreamController<Map<String, dynamic>>.broadcast();
  final _typingStopController = StreamController<Map<String, dynamic>>.broadcast();
  final _readController = StreamController<Map<String, dynamic>>.broadcast();
  final _connectController = StreamController<bool>.broadcast();

  Stream<ChatMessage> get onMessage => _messageController.stream;
  Stream<Map<String, dynamic>> get onMessageEdited => _messageEditedController.stream;
  Stream<Map<String, dynamic>> get onMessageDeleted => _messageDeletedController.stream;
  Stream<Map<String, dynamic>> get onTypingStart => _typingStartController.stream;
  Stream<Map<String, dynamic>> get onTypingStop => _typingStopController.stream;
  Stream<Map<String, dynamic>> get onRead => _readController.stream;
  Stream<bool> get onConnect => _connectController.stream;
  bool get isConnected => _socket?.connected ?? false;

  void connect(String token) {
    _socket = io.io(
      AppConstants.wsBaseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .enableAutoConnect()
          .build(),
    );

    _socket!.onConnect((_) {
      _connectController.add(true);
    });

    _socket!.onDisconnect((_) {
      _connectController.add(false);
    });

    _socket!.on('message:new', (data) {
      try {
        final msg = ChatMessage.fromJson(data as Map<String, dynamic>);
        _messageController.add(msg);
      } catch (_) {}
    });

    _socket!.on('message:edited', (data) {
      _messageEditedController.add(data as Map<String, dynamic>);
    });

    _socket!.on('message:deleted', (data) {
      _messageDeletedController.add(data as Map<String, dynamic>);
    });

    _socket!.on('typing:start', (data) {
      _typingStartController.add(data as Map<String, dynamic>);
    });

    _socket!.on('typing:stop', (data) {
      _typingStopController.add(data as Map<String, dynamic>);
    });

    _socket!.on('message:read', (data) {
      _readController.add(data as Map<String, dynamic>);
    });

    _socket!.onConnectError((err) {
      _connectController.add(false);
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  void sendMessage(String conversationId, String? body, {String? clientMessageId, List<Map<String, dynamic>>? attachments}) {
    _socket?.emit('message:send', {
      'conversationId': conversationId,
      if (body != null) 'body': body,
      if (clientMessageId != null) 'clientMessageId': clientMessageId,
      if (attachments != null) 'attachments': attachments,
    });
  }

  void startTyping(String conversationId) {
    _socket?.emit('typing:start', {'conversationId': conversationId});
  }

  void stopTyping(String conversationId) {
    _socket?.emit('typing:stop', {'conversationId': conversationId});
  }

  void markRead(String conversationId, String messageId) {
    _socket?.emit('message:read', {
      'conversationId': conversationId,
      'messageId': messageId,
    });
  }

  void dispose() {
    disconnect();
    _messageController.close();
    _messageEditedController.close();
    _messageDeletedController.close();
    _typingStartController.close();
    _typingStopController.close();
    _readController.close();
    _connectController.close();
  }
}
