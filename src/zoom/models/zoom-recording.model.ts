// src/zoom/dto/recording.model.ts
import { Column, Model, Table, ForeignKey, DataType } from 'sequelize-typescript';
import { ZoomMeeting } from './zoom-meeting.model';

@Table({ tableName: 'zoom_recordings', timestamps: false  })
export class Recording extends Model {
  @ForeignKey(() => ZoomMeeting)
  @Column(DataType.STRING)
  meeting_id: string;

  @Column(DataType.TEXT)
  download_url: string;

  @Column({ type: DataType.STRING, defaultValue: 'pendiente' })
  estado: string;
}
