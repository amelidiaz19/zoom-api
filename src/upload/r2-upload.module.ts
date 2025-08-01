import { Module } from '@nestjs/common';
import { R2UploaderService } from './r2-upload.service';
import { R2UploadController } from './r2-upload.controller';

@Module({
  providers: [R2UploaderService],
  controllers: [R2UploadController],
})
export class R2UploadModule {}