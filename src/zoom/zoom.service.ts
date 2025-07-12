// src/zoom/zoom.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import axios from 'axios';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { ZoomMeeting } from './models/zoom-meeting.model';
import { Recording } from './models/zoom-recording.model';
import { R2UploaderService } from '../upload/r2-upload.service';
import { Tag } from './models/tag.model';
import { Op } from 'sequelize';
import { Pool } from 'pg';

@Injectable()
export class ZoomService {

  private pgPool = new Pool({
    host: process.env.DB2_HOST,
    user: process.env.DB2_USER,
    password: process.env.DB2_PASSWORD,
    database: process.env.DB2_NAME,
    port: Number(process.env.DB2_PORT),
    ssl: { rejectUnauthorized: false }
  });

  private readonly logger = new Logger(ZoomService.name);
  private readonly zoomApiUrl = 'https://api.zoom.us/v2';
  private readonly secretToken: string;

  constructor(
    private config: ConfigService,
    @InjectModel(ZoomMeeting) private readonly zoomMeetingModel: typeof ZoomMeeting,
    @InjectModel(Recording) private readonly recordingModel: typeof Recording,
    @InjectModel(Tag) private readonly tagModel: typeof Tag,
    private readonly r2UploaderService: R2UploaderService,
  ) {
    this.secretToken = this.config.get<string>('ZOOM_WEBHOOK_SECRET') ?? '';
  }

  async generateToken(): Promise<string> {
    const base64 = Buffer.from(`${this.config.get('ZOOM_CLIENT_ID')}:${this.config.get('ZOOM_CLIENT_SECRET')}`).toString('base64');

    const response = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${this.config.get('ZOOM_ACCOUNT_ID')}`,
      {},
      { headers: { Authorization: `Basic ${base64}` } },
    );

    return response.data.access_token;
  }

  async createMeeting(body: any, userEmail: string): Promise<any> {
    const { topic, password, start_time, duration, agenda, tag } = body;
  
    const tagRecord = await this.tagModel.findOne({
      where: { nombre: tag },
    });
  
    if (!tagRecord) {
      throw new Error('Tag no encontrado');
    }
  
    const peruOffset = 5 * 60 * 60 * 1000;
    const startTimeUTC = new Date(start_time).getTime();
    const startTimePeru = new Date(startTimeUTC - peruOffset);
  
    const formattedStartTime = startTimePeru.toISOString().slice(0, 19);
  
    const token = await this.generateToken();
  
    try {

      const response = await axios.post(
        `${this.zoomApiUrl}/users/${userEmail}/meetings`,
        {
          topic,
          type: 2, // Reunión programada
          password,
          start_time: formattedStartTime,
          agenda,
          duration,
          settings: {
            host_video: true,
            participant_video: true,
            mute_upon_entry: false,
            waiting_room: true,
            auto_recording: 'cloud',
            join_before_host: true,
            download_access: false,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
  
      const meetingData = response.data;
  
      const newMeeting = await ZoomMeeting.create({
        zoom_id: meetingData.id.toString(),
        email: meetingData.host_email,
        topic: meetingData.topic,
        nomenclatura: meetingData.agenda,
        duracion: meetingData.duration,
        join_url: meetingData.join_url,
        start_url: meetingData.start_url,
        password: meetingData.password,
        tag_id: tagRecord.id,
      });
  
      return newMeeting.dataValues;
    } catch (error) {
      this.logger.error('Error al crear la reunión de Zoom', error.message);
      throw new Error('Failed to create Zoom meeting');
    }
  }
  
  async processRecording(payload: any, downloadToken: string) {
    const zoomId = payload?.object?.id;

    if (!zoomId) {
      throw new Error('zoomId no encontrado en el payload');
    }

    const meeting = await this.zoomMeetingModel.findOne({
      where: { zoom_id: zoomId.toString() },
    });

    if (!meeting) {
      throw new Error(`Reunión con zoom_id ${zoomId} no encontrada en la base de datos`);
    }

    const tag = await this.tagModel.findOne({
      where: { id: meeting.dataValues.tag_id },
    });

    if (!tag) {
      throw new Error(`Tag con id ${meeting.tag_id} no encontrado`);
    }

    const folderName = tag.dataValues.nombre.toLowerCase();

    //const folderPath = `zoom-recordings/${folderName}`;
    const folderPath = `Multimedia/Video/Cursos/ModulosVivo`;

    const mp4File = payload.object.recording_files.find((file) => file.file_type === 'MP4');
    if (!mp4File?.download_url) throw new Error('Archivo MP4 no encontrado');

    const downloadUrl = `${mp4File.download_url}?access_token=${downloadToken}`;
    const videoBuffer = await this.downloadFileAsBuffer(downloadUrl);

    const baseFilename = meeting.dataValues.nomenclatura;
    let filename = `${baseFilename}_1.mp4`;
    let count = 1;

    let exists = await this.recordingModel.findOne({
      where: {
        meeting_id: meeting.dataValues.zoom_id,
        // Busca archivos que empiecen igual
        download_url: { [Op.like]: `%/${folderPath}/${baseFilename}%` }
      }
    });

    if (exists) {
      const recordings = await this.recordingModel.findAll({
        where: {
          meeting_id: meeting.dataValues.zoom_id,
          download_url: { [Op.like]: `%/${folderPath}/${baseFilename}%` }
        }
      });
      count = recordings.length + 1;
      filename = `${baseFilename}_${count}.mp4`;
    }

    const uploadResult = await this.r2UploaderService.uploadVideoFromBuffer(
      videoBuffer,
      filename,
      folderPath,
    );

    const url = uploadResult.imagePublicUrl;
    const nombreArchivo = url.split('/').pop() ?? '';

    const match = nombreArchivo.match(/^([A-Z]+)_MODULO_(\d+)_G(\d+)(?:_(\d+))?\.mp4$/);

    let codigoCurso = '';
    let numeracion = '';
    let grupo = '';
    let orden = 1;

    if (match) {
      codigoCurso = match[1];      // Ej: 'POPP'
      numeracion = match[2];       // Ej: '5'
      grupo = match[3];            // Ej: '31'
      if (match[4]) orden = parseInt(match[4], 10); // Ej: '2'
    }

    const cursoResult = await this.pgPool.query(
      'SELECT "IdCurso", "Curso" FROM "Curso" WHERE "CodigoCurso" = $1 LIMIT 1',
      [codigoCurso]
    );
    const cursoRow = cursoResult.rows.length > 0 ? cursoResult.rows[0] : null;

    let productoTemarioId: number | null = null;
    if (cursoRow && 'IdCurso' in cursoRow) {
      const temarioResult = await this.pgPool.query(
        'SELECT "IdProductoTemario" FROM "ProductoTemario" WHERE "Curso_id" = $1 AND "Numeracion" = $2 LIMIT 1',
        [cursoRow.IdCurso, numeracion]
      );
      productoTemarioId = temarioResult.rows.length > 0 ? temarioResult.rows[0].IdProductoTemario : null;
    }

    let salaId: number | null = null;
    const nombreSala = `${codigoCurso} ${grupo}`;
    
    console.log('DEBUG nombreSala:', nombreSala);

    const salaResult = await this.pgPool.query(
      'SELECT "IdSala" FROM "Sala" WHERE "Sala" LIKE $1 LIMIT 1',
      [`%${nombreSala}%`]
    );
    salaId = salaResult.rows.length > 0 ? salaResult.rows[0].IdSala : null;

    if (productoTemarioId && salaId && cursoRow && 'Curso' in cursoRow) {
      await this.pgPool.query(
        `INSERT INTO "ProductoTemarioAdjunto"
          ("ProductoTemario_id", "Sala_id", "Tipo1", "Tipo2", "Tipo3", "Tipo4", "NombreArchivo", "NombreFinal", "Orden", "Estado_id")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          productoTemarioId,
          salaId,
          'Multimedia',
          'Video',
          'Cursos',
          'ModulosVivo',
          nombreArchivo,
          cursoRow.Curso,
          orden,
          1
        ]
      );

      console.log('--- CORRECTO DATOS PARA INSERT ProductoTemarioAdjunto ---');
        console.log('ProductoTemario_id:', productoTemarioId);
        console.log('Sala_id:', salaId);
        console.log('Tipo1:', 'Multimedia');
        console.log('Tipo2:', 'Video');
        console.log('Tipo3:', 'Cursos');
        console.log('Tipo4:', 'ModulosVivo');
        console.log('NombreArchivo:', nombreArchivo);
        console.log('Nombre Final:', cursoRow.Curso);
        console.log('Orden:', orden);
        console.log('Estado_id:', 1);
      console.log('-----------------------------------------------');
    }
    else{
      console.log('--- ERROR: DATOS PARA INSERT ProductoTemarioAdjunto ---');
        console.log('ProductoTemario_id:', productoTemarioId);
        console.log('Sala_id:', salaId);
        console.log('Tipo1:', 'Multimedia');
        console.log('Tipo2:', 'Video');
        console.log('Tipo3:', 'Cursos');
        console.log('Tipo4:', 'ModulosVivo');
        console.log('NombreArchivo:', nombreArchivo);
        console.log('Nombre Final:', cursoRow.Curso);
        console.log('Orden:', orden);
        console.log('Estado_id:', 1);
      console.log('-----------------------------------------------');
    }
    
    await this.recordingModel.create({
      meeting_id: meeting.dataValues.zoom_id,
      download_url: uploadResult.imagePublicUrl,
      estado: 'pendiente',
    });

    return uploadResult.imagePublicUrl;

  }

  private async downloadFileAsBuffer(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  async listMeetings(tag: string) {
    return this.zoomMeetingModel.findAll({
      where: { tag_id: tag }
    });
  }

  generateSignature(meetingNumber: string, role: number): string {
    const payload = {
      sdkKey: this.config.get<string>('ZOOM_SDK_KEY'),
      mn: meetingNumber,
      role,
      iat: Math.floor(Date.now() / 1000) - 30,
      exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60,
      appKey: this.config.get<string>('ZOOM_SDK_KEY'),
      tokenExp: Math.floor(Date.now() / 1000) + 2 * 60 * 60,
    };

    return jwt.sign(payload, this.config.get<string>('ZOOM_SDK_SECRET'), { algorithm: 'HS256' });
  }

  async validateSignature(event: string, timestamp: string, body: any, signature: string): Promise<boolean> {
    if (event === 'endpoint.url_validation') return true;

    const msg = `v0:${timestamp}:${JSON.stringify(body)}`;
    const hash = crypto.createHmac('sha256', this.secretToken).update(msg).digest('hex');
    return signature === `v0=${hash}`;
  }

  async handleValidation(plainToken: string) {
    const encryptedToken = crypto.createHmac('sha256', this.secretToken).update(plainToken).digest('hex');
    return { plainToken, encryptedToken };
  }
}
