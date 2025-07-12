import { Controller, Put, Param, Body, Get, Post, Delete } from '@nestjs/common';
import { SalaService } from './sala.service';

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
}