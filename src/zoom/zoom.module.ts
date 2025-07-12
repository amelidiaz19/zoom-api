// src/zoom/zoom.module.ts
import { Module } from '@nestjs/common';
import { ZoomController } from './zoom.controller';
import { ZoomService } from './zoom.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { ZoomMeeting } from './models/zoom-meeting.model';
import { Recording } from './models/zoom-recording.model';
import { Tag } from './models/tag.model';
import { R2UploaderService } from 'src/upload/r2-upload.service';

@Module({
  imports: [SequelizeModule.forFeature([ZoomMeeting, Recording, Tag])],
  controllers: [ZoomController],
  providers: [ZoomService, R2UploaderService],
})
export class ZoomModule {}
