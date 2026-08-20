import 'package:dio/dio.dart';

class UploadResult {
  final String url;
  final String fileName;
  final String? mimeType;
  final int? size;

  UploadResult({
    required this.url,
    required this.fileName,
    this.mimeType,
    this.size,
  });

  factory UploadResult.fromJson(Map<String, dynamic> json) {
    return UploadResult(
      url: json['url'] as String,
      fileName: json['fileName'] as String,
      mimeType: json['mimeType'] as String?,
      size: json['size'] as int?,
    );
  }
}

class UploadService {
  UploadService(this._dio);
  final Dio _dio;

  Future<UploadResult> uploadFile(String filePath, {void Function(int sent, int total)? onProgress}) async {
    final fileName = filePath.split('/').last;
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        filePath,
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

    return UploadResult.fromJson(response.data as Map<String, dynamic>);
  }
}
