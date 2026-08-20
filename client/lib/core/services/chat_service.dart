import 'dart:io';

import 'package:dio/dio.dart';
import '../models/conversation.dart';
import '../models/chat_message.dart';

class ChatService {
  ChatService(this._dio);

  final Dio _dio;

  Future<List<Conversation>> getConversations() async {
    final response = await _dio.get('/conversations');
    final data = response.data as Map<String, dynamic>;
    final list = data['conversations'] as List<dynamic>;
    return list.map((c) => Conversation.fromJson(c as Map<String, dynamic>)).toList();
  }

  Future<String> createConversation(List<String> participantIds, {String? title}) async {
    final response = await _dio.post('/conversations', data: {
      'participantIds': participantIds,
      if (title != null) 'title': title,
    });
    final data = response.data as Map<String, dynamic>;
    return data['conversationId'] as String;
  }

  Future<Conversation> getConversation(String id) async {
    final response = await _dio.get('/conversations/$id');
    final data = response.data as Map<String, dynamic>;
    return Conversation.fromJson(data['conversation'] as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> getMessages(String conversationId, {String? cursor}) async {
    final response = await _dio.get('/conversations/$conversationId/messages', queryParameters: {
      if (cursor != null) 'cursor': cursor,
    });
    final data = response.data as Map<String, dynamic>;
    return {
      'messages': (data['messages'] as List<dynamic>)
          .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
          .toList(),
      'nextCursor': data['nextCursor'] as String?,
      'hasMore': data['hasMore'] as bool,
    };
  }

  Future<ChatMessage> sendMessage(
    String conversationId, {
    String? body,
    String? clientMessageId,
    String? replyToId,
    List<Map<String, dynamic>>? attachments,
  }) async {
    final response = await _dio.post('/conversations/$conversationId/messages', data: {
      if (body != null && body.isNotEmpty) 'body': body,
      if (clientMessageId != null) 'clientMessageId': clientMessageId,
      if (replyToId != null) 'replyToId': replyToId,
      if (attachments != null && attachments.isNotEmpty) 'attachments': attachments,
    });
    final data = response.data as Map<String, dynamic>;
    return ChatMessage.fromJson(data['message'] as Map<String, dynamic>);
  }

  Future<void> markRead(String conversationId, String messageId) async {
    await _dio.post('/conversations/$conversationId/messages/$messageId/read');
  }

  Future<ChatMessage> editMessage(String conversationId, String messageId, String body) async {
    final response = await _dio.patch('/conversations/$conversationId/messages/$messageId', data: {
      'body': body,
    });
    final data = response.data as Map<String, dynamic>;
    return ChatMessage.fromJson(data['message'] as Map<String, dynamic>);
  }

  Future<void> deleteMessage(String conversationId, String messageId) async {
    await _dio.delete('/conversations/$conversationId/messages/$messageId');
  }

  Future<Map<String, dynamic>> uploadFile(File file, {Function(int, int)? onProgress}) async {
    final fileName = file.path.split('/').last;
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        file.path,
        filename: fileName,
      ),
    });

    final response = await _dio.post(
      '/uploads',
      data: formData,
      onSendProgress: onProgress,
      options: Options(
        headers: {'Content-Type': 'multipart/form-data'},
      ),
    );

    return response.data as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> searchMessages(String query, {String? conversationId, int limit = 20}) async {
    final response = await _dio.get('/search/messages', queryParameters: {
      'q': query,
      if (conversationId != null) 'conversationId': conversationId,
      'limit': limit,
    });
    final data = response.data as Map<String, dynamic>;
    return (data['messages'] as List<dynamic>).cast<Map<String, dynamic>>();
  }
}
