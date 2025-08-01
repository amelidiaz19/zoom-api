import { 
  Controller, 
  Post, 
  UploadedFile, 
  UseInterceptors, 
  Body,
  BadRequestException, 
  NotFoundException,
  Delete,
  Param
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { R2UploaderService } from './r2-upload.service';

@Controller('upload')
export class R2UploadController {
  constructor(private readonly r2UploaderService: R2UploaderService) {}

  @Post('mp4')
  @UseInterceptors(FileInterceptor('file'))
  async subirMP4(
    @UploadedFile() file: Express.Multer.File,
    @Body('carpeta') carpeta?: string
  ) {
    if (!file) {
      throw new BadRequestException('No se ha proporcionado ningún archivo');
    }

    if (file.mimetype !== 'video/mp4') {
      throw new BadRequestException('Solo se permiten archivos MP4');
    }

    if (!file.originalname.toLowerCase().endsWith('.mp4')) {
      throw new BadRequestException('El archivo debe tener extensión .mp4');
    }

    try {
      const resultado = await this.r2UploaderService.uploadVideoFromBuffer(
        file.buffer,
        file.originalname,
        carpeta || 'Multimedia/Video/Cursos/ModulosVivo'
      );

      return {
        success: true,
        message: 'Video MP4 subido exitosamente a Cloudflare R2',
        archivo: {
          nombre: file.originalname,
          tamaño: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          tipo: 'video/mp4',
          carpeta: carpeta || 'Multimedia/Video/Cursos/ModulosVivo'
        },
        urls: {
          r2Location: resultado.imageUrl,
          urlPublica: resultado.imagePublicUrl
        }
      };

    } catch (error) {
      throw new BadRequestException(`Error al subir MP4: ${error.message}`);
    }
  }

  @Delete('mp4/:nombreArchivo')
  async eliminarMP4(
    @Param('nombreArchivo') nombreArchivo: string,
    @Body('carpeta') carpeta?: string
  ) {
    if (!nombreArchivo) {
      throw new BadRequestException('Debe proporcionar el nombre del archivo');
    }
    
    if (!nombreArchivo.toLowerCase().endsWith('.mp4')) {
      throw new BadRequestException('Solo se pueden eliminar archivos .mp4');
    }

    try {
      await this.r2UploaderService.deleteVideoFromR2(
        nombreArchivo,
        carpeta || 'Multimedia/Video/Cursos/ModulosVivo'
      );

      return {
        success: true,
        message: 'Video MP4 eliminado exitosamente de Cloudflare R2',
        archivo: {
          nombre: nombreArchivo,
          carpeta: carpeta || 'Multimedia/Video/Cursos/ModulosVivo',
          estado: 'Eliminado'
        }
      };

    } catch (error) {
      if (error.code === 'NoSuchKey') {
        throw new NotFoundException(`El archivo ${nombreArchivo} no existe en R2`);
      }
      throw new BadRequestException(`Error al eliminar MP4: ${error.message}`);
    }
  }
  
}