// src/zoom/models/zoom-meeting.model.ts
import { Column, Model, Table, DataType, ForeignKey, PrimaryKey } from 'sequelize-typescript';
import { Tag } from './tag.model';

@Table({ tableName: 'zoom_meetings' , timestamps: false })
export class ZoomMeeting extends Model {

  @PrimaryKey
  @Column({ type: DataType.STRING, allowNull: false })
  zoom_id: string;

  @Column(DataType.STRING)
  email: string;

  @Column(DataType.STRING)
  topic: string;

  @Column(DataType.STRING)
  nomenclatura: string;

  @Column(DataType.INTEGER)
  duracion: number;

  @Column(DataType.STRING)
  join_url: string;

  @Column(DataType.STRING)
  start_url: string;

  @Column(DataType.STRING)
  password: string;

  @ForeignKey(() => Tag)
  @Column({ type: DataType.INTEGER, allowNull: false })
  tag_id: number;
}
