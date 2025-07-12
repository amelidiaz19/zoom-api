import { Injectable } from '@nestjs/common';
import { S3 } from 'aws-sdk';

@Injectable()
export class R2UploaderService {
  private readonly r2S3Client: S3;
  private readonly r2BucketName: string;

  constructor() {
    const r2EndpointUrl = process.env.R2_ENDPOINT_URL;
    const r2AccessKeyId = process.env.R2_ACCESS_KEY;
    const r2SecretAccessKey = process.env.R2_SECRET_KEY;
    const r2BucketName = process.env.R2_BUCKET_NAME;

    if (!r2EndpointUrl || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
      throw new Error('La configuración de Cloudflare R2 no está completa en las variables de entorno.');
    }

    this.r2S3Client = new S3({
      endpoint: r2EndpointUrl,
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
      signatureVersion: 's3v4',
      region: 'auto',
    });
    this.r2BucketName = r2BucketName;
  }

  async uploadVideoFromBuffer(
    buffer: Buffer,
    originalName: string,
    folderPath?: string,
  ): Promise<any> {
    const key = folderPath ? `${folderPath}/${originalName}` : originalName;

    try {
      const result = await this.r2S3Client
        .upload({
          Bucket: this.r2BucketName,
          Key: key,
          Body: buffer,
          ContentType: 'video/mp4',
        })
        .promise();

      const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
      const publicUrl = `${publicBaseUrl}/${key.replace(/ /g, '%20')}`;

      return {
        message: 'Video subido exitosamente',
        imageUrl: result.Location,
        imagePublicUrl: publicUrl,
      };
    } catch (error) {
      console.error('Error al subir el video a R2:', error);
      throw new Error('Error al subir el video a R2');
    }
  }
}
