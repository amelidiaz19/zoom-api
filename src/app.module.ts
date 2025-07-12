/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { Recording } from './zoom/models/zoom-recording.model';
import { Tag } from './zoom/models/tag.model';
import { ZoomMeeting } from './zoom/models/zoom-meeting.model';
import { ZoomModule } from './zoom/zoom.module';
import { SalaModule } from './sala/sala.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SequelizeModule.forRoot({
      dialect: 'mysql',
      host: process.env.DB_HOST,
      port: +(process.env.DB_PORT ?? 3306),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadModels: true,
      synchronize: true,
      models: [Tag, ZoomMeeting, Recording],
    }),
    ZoomModule,
    SalaModule
  ],
})
export class AppModule {}
