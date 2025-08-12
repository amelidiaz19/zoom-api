/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { Recording } from './zoom/models/zoom-recording.model';
import { Tag } from './zoom/models/tag.model';
import { ZoomMeeting } from './zoom/models/zoom-meeting.model';
import { ZoomModule } from './zoom/zoom.module';
import { SalaModule } from './sala/sala.module';
import { R2UploadModule } from './upload/r2-upload.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SequelizeModule.forRoot({
      dialect: 'postgres',
      host: process.env.DB_HOST,
      port: +(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadModels: true,
      synchronize: true,
      models: [Tag, ZoomMeeting, Recording],
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } ,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    }),
    ZoomModule,
    SalaModule,
    R2UploadModule
  ],
})
export class AppModule {}
