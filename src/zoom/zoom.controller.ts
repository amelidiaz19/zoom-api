// src/zoom/zoom.controller.ts
import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  Res,
  Param,
  Get,
  Query,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZoomService } from './zoom.service';
import { CreateMeetingZoomDto } from './dto/create-meeting-zoom.dto';

@Controller('zoom')
export class ZoomController {
  constructor(private readonly zoomService: ZoomService) {}

  // Obtener token de Zoom
  @Get('token')
  async generateToken() {
    try {
      const token = await this.zoomService.generateToken();
      return { access_token: token };
    } catch (error) {
      return {
        error: 'Failed to generate Access Token',
        message: error.message,
      };
    }
  }

  // Crear una nueva reunión
  @Post('create')
  async createMeeting(@Body() body: any) {
    const { userEmail, ...createMeetingDto } = body;
    return this.zoomService.createMeeting(createMeetingDto, userEmail);
  }

  // Webhook de Zoom (grabación completada, validación, etc.)
  @Post('webhook')
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('x-zm-signature') signature: string,
    @Headers('x-zm-request-timestamp') timestamp: string,
  ) {
    try {
      const event = req.body?.event;
      const body = req.body;

      const isValid = await this.zoomService.validateSignature(
        event,
        timestamp,
        body,
        signature,
      );

      if (!isValid) {
        return res
          .status(HttpStatus.FORBIDDEN)
          .json({ message: 'Firma inválida' });
      }

      if (event === 'endpoint.url_validation') {
        const result = await this.zoomService.handleValidation(
          body.payload.plainToken,
        );
        return res.status(HttpStatus.OK).json(result);
      }

      if (event === 'recording.completed') {
        
        const result = await this.zoomService.processRecording(
          body.payload,
          body.download_token
        );

        return res.status(HttpStatus.OK).json({ message: result });
      }

      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: 'Evento no procesado' });
    } catch (error) {
      console.error('Error en Webhook:', error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: 'Error interno' });
    }
  }

  // Listar reuniones por tag: /zoom/list?tag=ccd
  @Get('list')
  async listMeetings(@Query('tag') tag: string) {
    try {
      const meetings = await this.zoomService.listMeetings(tag);
      return meetings;
    } catch (error) {
      throw new HttpException(
        {
          message: 'No se pudieron obtener las reuniones',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Generar firma JWT para unirse a reunión
  @Post('unirse')
  async generateSignature(@Body() body: { meetingId: string; role: number }) {
    const { meetingId, role } = body;

    try {
      const signature = this.zoomService.generateSignature(meetingId, role);
      return { signature };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Error al generar la firma',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('process-recording')
  async processRecordingDirect(
    @Body() body: { payload: any; download_token: string },
    @Res() res: Response,
  ) {
    try {
      
      const result = await this.zoomService.processRecording(
        body.payload,
        body.download_token,
      );

      return res.status(HttpStatus.OK).json({ message: result });
    } catch (error) {
      console.error('Error al procesar la grabación:', error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: 'Error al procesar la grabación', error: error.message });
    }
  }

}
