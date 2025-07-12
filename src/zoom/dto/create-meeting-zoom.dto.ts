/* eslint-disable prettier/prettier */
import { IsString, IsNumber } from 'class-validator';

export class CreateMeetingZoomDto {

  @IsString()
  titulo: string;
  
  @IsString()
  password: string;

  @IsString()
  start_time: string;

  @IsNumber()
  duracion: number;

  @IsString()
  nomenclatura: string;

  @IsString()
  tag: string;
}
