import { Controller, Put, Param, Body, Get, Post, Delete, Res } from '@nestjs/common';
import { SalaService } from './sala.service';

import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';


@Controller('sala')
export class SalaController {
  constructor(private readonly salaService: SalaService) {}


  @Get(':id/videos')
  async listarVideos(@Param('id') id: string) {
    const salaId = Number(id);
    return this.salaService.listarVideosPorSala(salaId);
  }

  @Post('asignar')
  async asignarVideoManual(@Body() body: {
    salaIds: number[],
    cursoId: number,
    numeracion: string,
    nombreArchivo: string,
    nombreFinal: string
  }) {
    return this.salaService.asignarVideoPorCurso(body);
  }

  @Post('asignar-multiple')
  async asignarVideoMultiple(@Body() body: {
    asignaciones: {
      salaId: number,
      cursoId: number,
      numeracion: string,
      nombreArchivo: string,
      nombreFinal: string
    }[]
  }) {
    return this.salaService.asignarVideoMultiple(body.asignaciones);
  }

  @Put(':id/zoom')
  async actualizarLinkZoom(
    @Param('id') id: number,
    @Body() body: Record<string, any>
  ) {
    return this.salaService.actualizarCampos(Number(id), body);
  }

  @Delete('adjunto/:id')
  async eliminarAdjunto(@Param('id') id: string) {
    return this.salaService.eliminarAdjuntoPorId(Number(id));
  }

  @Delete('duplicados')
  async eliminarDuplicadosRango(@Body() body: { 
    fechaInicio: string, 
    fechaFin: string 
  }) {
    return this.salaService.eliminarDuplicadosRangoFechas(body.fechaInicio, body.fechaFin);
  }

  @Get('descargar-reporte/:nombreArchivo')
  async descargarReporte(
    @Param('nombreArchivo') nombreArchivo: string,
    @Res() res: Response
  ) {
    try {
      // Obtener reporte desde R2
      const contenido = await this.salaService.obtenerReporteDesdeR2(nombreArchivo);
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
      
      return res.send(contenido);
      
    } catch (error) {
      return res.status(404).json({ 
        message: 'Reporte no encontrado en R2',
        archivo: nombreArchivo,
        error: error.message 
      });
    }
  }

  @Get('reportes')
  async listarReportes() {
    return this.salaService.listarReportesDesdeR2();
  }

}