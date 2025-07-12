/* eslint-disable prettier/prettier */
import { Column, Model, Table, HasMany, DataType } from 'sequelize-typescript';
import { ZoomMeeting } from './zoom-meeting.model';

@Table({ tableName: 'tags' , timestamps: false })
export class Tag extends Model {
  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  nombre: string;

  @HasMany(() => ZoomMeeting)
  zoomMeetings: ZoomMeeting[];
}
