import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { badRequest } from '../utils/errors';
import { storeFile } from '../utils/storage';
import { sniffImage, sniffAudio, sniffVideo } from '../utils/upload-security';

export class UploadsController {
  static readonly routePrefix = '/uploads';

  static registerRoutes(app: FastifyInstance): void {
    app.post(`${this.routePrefix}`, { preValidation: [requireAuth] }, UploadsController.upload);
  }

  static async upload(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parts = req.parts();
    let fileBuffer: Buffer | null = null;
    let fileName = 'unknown';

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        fileBuffer = Buffer.concat(chunks);
        fileName = part.filename || 'unknown';
      }
    }

    if (!fileBuffer) {
      throw badRequest('No file uploaded');
    }

    const sniffedImg = sniffImage(fileBuffer);
    const sniffedAudio = !sniffedImg ? sniffAudio(fileBuffer) : null;
    const sniffedVideo = !sniffedImg && !sniffedAudio ? sniffVideo(fileBuffer) : null;
    const sniffed = sniffedImg ?? sniffedAudio ?? sniffedVideo;

    if (!sniffed) {
      const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
      const result = await storeFile(fileBuffer, `upload${ext || '.bin'}`, 'application/octet-stream');
      reply.status(201).send({
        url: result.url,
        fileName: result.fileName,
        originalName: fileName,
        mimeType: result.mimeType,
        size: result.size,
      });
      return;
    }

    const result = await storeFile(fileBuffer, `upload${sniffed.ext}`, sniffed.mime);

    reply.status(201).send({
      url: result.url,
      fileName: result.fileName,
      originalName: fileName,
      mimeType: result.mimeType,
      size: result.size,
    });
  }
}
