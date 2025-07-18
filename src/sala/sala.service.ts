import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

import { promisify } from 'util';
import { exec } from 'child_process';

const ffprobeStatic = require('ffprobe-static');
const execAsync = promisify(exec);

import * as fs from 'fs';
import * as path from 'path';

import { S3 } from 'aws-sdk';

export interface VideoEliminado {
  id: any;
  nombre: any;
  sala: any;
  orden: any;
  duracion: any;
  fechaCreacion: any;
  estado: string;
}

@Injectable()
export class SalaService {
  private pool = new Pool({
    host: process.env.DB2_HOST,
    port: Number(process.env.DB2_PORT),
    user: process.env.DB2_USER,
    password: process.env.DB2_PASSWORD,
    database: process.env.DB2_NAME,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  async actualizarCampos(id: number, campos: { [key: string]: any }) {
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key in campos) {
      setClauses.push(`"${key}" = $${idx++}`);
      values.push(campos[key]);
    }
    values.push(id);

    const query = `UPDATE "Sala" SET ${setClauses.join(', ')} WHERE "IdSala" = $${idx}`;
    await this.pool.query(query, values);
    return { message: 'Campos actualizados correctamente' };
  }

  async listarVideosPorSala(salaId: number) {
    const query = `
      SELECT * FROM "ProductoTemarioAdjunto"
      WHERE "Tipo2" = 'Video'
        AND "Sala_id" IS NOT NULL
        AND "Tipo4" = 'ModulosVivo'
        AND "Sala_id" = $1
      ORDER BY "Orden" ASC
    `;
    const result = await this.pool.query(query, [salaId]);
    const vistos = new Set<string>();
    const videos: any[] = [];
    for (const row of result.rows) {
      if (!vistos.has(row.NombreArchivo)) {
        vistos.add(row.NombreArchivo);
        videos.push({
          IdProductoTemarioAdjunto: row.IdProductoTemarioAdjunto,
          ProductoTemario_id: row.ProductoTemario_id,
          Sala_id: row.Sala_id,
          NombreArchivo: row.NombreArchivo,
          Estado_id: row.Estado_id,
          Orden: row.Orden,
          NombreFinal: row.NombreFinal,
        });
      }
    }
    return videos;
  }

  async asignarVideoPorCurso({
    salaIds,
    cursoId,
    numeracion,
    nombreArchivo,
    nombreFinal
  }: {
    salaIds: number[],
    cursoId: number,
    numeracion: string,
    nombreArchivo: string,
    nombreFinal: string
  }) {

    const temarioRes = await this.pool.query(
      'SELECT "IdProductoTemario" FROM "ProductoTemario" WHERE "Curso_id" = $1 AND "Numeracion" = $2 LIMIT 1',
      [cursoId, numeracion]
    );
    const productoTemarioId = temarioRes.rows.length > 0 ? temarioRes.rows[0].IdProductoTemario : null;
    if (!productoTemarioId) throw new Error('ProductoTemario no encontrado');

    for (const salaId of salaIds) {

      const ordenRes = await this.pool.query(
        `SELECT COALESCE(MAX("Orden"), 0) AS ultimoOrden
        FROM "ProductoTemarioAdjunto"
        WHERE "Sala_id" = $1 AND "ProductoTemario_id" = $2`,
        [salaId, productoTemarioId]
      );
      const ultimoOrden = ordenRes.rows[0].ultimoorden || ordenRes.rows[0].ultimoOrden || 0;
      const nuevoOrden = Number(ultimoOrden) + 1;

      await this.pool.query(
        `INSERT INTO "ProductoTemarioAdjunto"
          ("ProductoTemario_id", "Sala_id", "Tipo1", "Tipo2", "Tipo3", "Tipo4", "NombreArchivo", "NombreFinal", "Orden", "Estado_id")
        VALUES ($1, $2, 'Multimedia', 'Video', 'Cursos', 'ModulosVivo', $3, $4, $5, 1)`,
        [
          productoTemarioId,
          salaId,
          nombreArchivo,
          nombreFinal,
          nuevoOrden
        ]
      );
    }
    return { message: 'Video asignado correctamente a todas las salas' };
  }

  async asignarVideoMultiple(asignaciones: {
    salaId: number,
    cursoId: number,
    numeracion: string,
    nombreArchivo: string,
    nombreFinal: string
  }[]) {
    for (const asignacion of asignaciones) {
      const { salaId, cursoId, numeracion, nombreArchivo, nombreFinal } = asignacion;
      const temarioRes = await this.pool.query(
        'SELECT "IdProductoTemario" FROM "ProductoTemario" WHERE "Curso_id" = $1 AND "Numeracion" = $2 LIMIT 1',
        [cursoId, numeracion]
      );
      const productoTemarioId = temarioRes.rows.length > 0 ? temarioRes.rows[0].IdProductoTemario : null;
      if (!productoTemarioId) continue;

      const ordenRes = await this.pool.query(
        `SELECT COALESCE(MAX("Orden"), 0) AS ultimoOrden
        FROM "ProductoTemarioAdjunto"
        WHERE "Sala_id" = $1 AND "ProductoTemario_id" = $2`,
        [salaId, productoTemarioId]
      );
      const ultimoOrden = ordenRes.rows[0].ultimoorden || ordenRes.rows[0].ultimoOrden || 0;
      const nuevoOrden = Number(ultimoOrden) + 1;

      await this.pool.query(
        `INSERT INTO "ProductoTemarioAdjunto"
          ("ProductoTemario_id", "Sala_id", "Tipo1", "Tipo2", "Tipo3", "Tipo4", "NombreArchivo", "NombreFinal", "Orden", "Estado_id")
        VALUES ($1, $2, 'Multimedia', 'Video', 'Cursos', 'ModulosVivo', $3, $4, $5, 1)`,
        [
          productoTemarioId,
          salaId,
          nombreArchivo,
          nombreFinal,
          nuevoOrden
        ]
      );
    }
    return { message: 'Videos asignados correctamente a las salas y cursos indicados' };
  }

  async eliminarAdjuntoPorId(id: number) {
    await this.pool.query(
      'DELETE FROM "ProductoTemarioAdjunto" WHERE "IdProductoTemarioAdjunto" = $1',
      [id]
    );
    return { message: 'Video adjunto eliminado correctamente' };
  }

  async eliminarDuplicadosRangoFechas(fechaInicio: string, fechaFin: string) {
    
    const reporteLineas: string[] = [];
    
    const agregarLinea = (texto: string) => {
      console.log(texto);
      reporteLineas.push(texto);
    };

    agregarLinea(`\n📅 === ELIMINACIÓN DE DUPLICADOS RANGO: ${fechaInicio} a ${fechaFin} (Hora Perú) ===`);
    
    const fechaInicioUTC = this.convertirFechaPeruAUTC(fechaInicio, '00:00:00');
    const fechaFinUTC = this.convertirFechaPeruAUTC(fechaFin, '23:59:59');
    
    agregarLinea(`🕐 Rango UTC: ${fechaInicioUTC} a ${fechaFinUTC}`);
    
    const query = `
      SELECT "IdProductoTemarioAdjunto", "NombreArchivo", "NombreFinal", "Orden", "Sala_id", "UltimaFechMod"
      FROM "ProductoTemarioAdjunto"
      WHERE "Tipo2" = 'Video'
        AND "Sala_id" IS NOT NULL
        AND "Tipo4" = 'ModulosVivo'
        AND "UltimaFechMod" >= $1
        AND "UltimaFechMod" <= $2
      ORDER BY "Sala_id", "Orden" ASC
    `;
    
    const result = await this.pool.query(query, [fechaInicioUTC, fechaFinUTC]);
    
    if (result.rows.length === 0) {
      console.log(`❌ No se encontraron videos entre ${fechaInicio} y ${fechaFin}`);
      return { 
        message: `No hay videos entre ${fechaInicio} y ${fechaFin} (hora Perú)`,
        rango: { fechaInicio, fechaFin },
        videosEncontrados: 0,
        duplicados: []
      };
    }
    
    agregarLinea(`📊 Videos encontrados en el rango: ${result.rows.length}`);
    
    const videosConDuracion: any[] = [];
    const salaStats = new Map<number, number>();
    
    result.rows.forEach(video => {
      const count = salaStats.get(video.Sala_id) || 0;
      salaStats.set(video.Sala_id, count + 1);
    });
    
    console.log(`🏠 Salas afectadas: ${Array.from(salaStats.keys()).join(', ')}`);
    salaStats.forEach((count, salaId) => {
      console.log(`   Sala ${salaId}: ${count} videos`);
    });
    
    for (const video of result.rows) {
      try {
        const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL + '/Multimedia/Video/Cursos/ModulosVivo';
        const videoUrl = `${publicBaseUrl}/${video.NombreArchivo.replace(/ /g, '%20')}`;
        
        const ffprobePath = ffprobeStatic.path || ffprobeStatic;
        const command = `"${ffprobePath}" -v quiet -show_entries format=duration -of csv=p=0 "${videoUrl}"`;
        
        const { stdout } = await execAsync(command, { timeout: 30000 });
        const duration = parseFloat(stdout.trim()) || 0;
        
        const videoData = {
          ...video,
          duration,
          videoUrl,
          fechaCreacion: video.UltimaFechMod,
          fechaCreacionPeru: this.convertirUTCAFechaPeruString(video.UltimaFechMod)
        };
        
        videosConDuracion.push(videoData);
        
        console.log(`✅ ${video.NombreArchivo} (Sala: ${video.Sala_id}) - ${duration.toFixed(1)}s`);
        
      } catch (error) {
        console.log(`❌ Error analizando: ${video.NombreArchivo} - ${error.message}`);
      }
    }
    
    const videosPorSala = new Map<number, any[]>();
    
    videosConDuracion.forEach(video => {
      if (!videosPorSala.has(video.Sala_id)) {
        videosPorSala.set(video.Sala_id, []);
      }
      videosPorSala.get(video.Sala_id)!.push(video);
    });
    
    const duplicadosPorSala: { salaId: number; duracion: string; videos: any[] }[] = [];
    
    for (const [salaId, videos] of videosPorSala.entries()) {
      agregarLinea(`\n🏠 Analizando duplicados en Sala ${salaId} (${videos.length} videos):`);
      
      const duracionesEnSala = new Map<string, any[]>();
      
      videos.forEach(video => {
        const durationKey = video.duration.toFixed(1);
        if (!duracionesEnSala.has(durationKey)) {
          duracionesEnSala.set(durationKey, []);
        }
        duracionesEnSala.get(durationKey)!.push(video);
      });
      
      const duplicadosEnSala: { salaId: number; duracion: string; videos: any[] }[] = [];
      for (const [duracion, videosConMismaDuracion] of duracionesEnSala.entries()) {
        if (videosConMismaDuracion.length > 1) {
          duplicadosEnSala.push({ 
            salaId, 
            duracion, 
            videos: videosConMismaDuracion 
          });
          agregarLinea(`   🔍 Duración ${duracion}s: ${videosConMismaDuracion.length} duplicados`);
        }
      }
      
      if (duplicadosEnSala.length > 0) {
        duplicadosPorSala.push(...duplicadosEnSala);
      } else {
        agregarLinea(`   ✅ Sin duplicados en esta sala`);
      }
    }
    
    if (duplicadosPorSala.length === 0) {
      agregarLinea(`✅ No se encontraron duplicados dentro de las salas del rango ${fechaInicio} - ${fechaFin}`);
      return { 
        message: `No hay duplicados dentro de las salas del rango ${fechaInicio} - ${fechaFin}`,
        rango: { fechaInicio, fechaFin },
        videosAnalizados: videosConDuracion.length,
        duplicados: []
      };
    }
    
    const videosEliminados: VideoEliminado[] = [];
    const erroresEliminacion: { archivo: any; sala: any; orden: any; fechaCreacion: any; error: any }[] = [];
    let totalGruposDuplicados = 0;
    
    for (const grupo of duplicadosPorSala) {
      const { salaId, duracion, videos } = grupo;
      totalGruposDuplicados++;
      
      videos.sort((a, b) => {
        const fechaA = new Date(a.fechaCreacion).getTime();
        const fechaB = new Date(b.fechaCreacion).getTime();
        if (fechaA !== fechaB) return fechaB - fechaA;
        return a.Orden - b.Orden;
      });
      
      const videoAMantener = videos[0];
      const videosAEliminar = videos.slice(1);
      
      agregarLinea(`\n🔍 Sala ${salaId} - Duración ${duracion}s - ${videos.length} videos duplicados:`);
      agregarLinea(`✅ MANTENER: ${videoAMantener.NombreArchivo} (Orden: ${videoAMantener.Orden}, ${videoAMantener.fechaCreacionPeru})`);
      
      for (const video of videosAEliminar) {
        agregarLinea(`🗑️ ELIMINANDO: ${video.NombreArchivo} (Orden: ${video.Orden}, ${video.fechaCreacionPeru})`);
        
        try {
          console.log(`   🔄 Eliminando de R2...`);
          await this.eliminarDeCloudflareR2(video.NombreArchivo);
          console.log(`   ✅ Eliminado de R2`);
          console.log(`   🔄 Eliminando de BD...`);
          await this.pool.query(
            'DELETE FROM "ProductoTemarioAdjunto" WHERE "IdProductoTemarioAdjunto" = $1',
            [video.IdProductoTemarioAdjunto]
          );
          console.log(`   ✅ Eliminado de BD`);
          
          videosEliminados.push({
            id: video.IdProductoTemarioAdjunto,
            nombre: video.NombreArchivo,
            sala: video.Sala_id,
            orden: video.Orden,
            duracion: video.duration,
            fechaCreacion: video.fechaCreacionPeru,
            estado: 'Eliminado completamente'
          });
          
          agregarLinea(`   🎉 ELIMINADO COMPLETAMENTE`);
          
        } catch (error) {
          agregarLinea(`   ❌ Error durante eliminación: ${error.message}`);
          agregarLinea(`   ⚠️ VIDEO CONSERVADO por seguridad`);
          
          erroresEliminacion.push({
            archivo: video.NombreArchivo,
            sala: video.Sala_id,
            orden: video.Orden,
            fechaCreacion: video.fechaCreacionPeru,
            error: error.message
          });
        }
      }
    }
    
    agregarLinea(`\n📊 RESUMEN ELIMINACIÓN RANGO ${fechaInicio} - ${fechaFin}:`);
    agregarLinea(`   Videos analizados: ${videosConDuracion.length}`);
    agregarLinea(`   Grupos duplicados por sala: ${totalGruposDuplicados}`);
    agregarLinea(`   Videos eliminados: ${videosEliminados.length}`);
    agregarLinea(`   Videos conservados por errores: ${erroresEliminacion.length}`);
    agregarLinea(`   Salas procesadas: ${salaStats.size}`);
    
    const resumenPorSala = new Map<number, { eliminados: number, errores: number }>();
    
    videosEliminados.forEach(video => {
      if (!resumenPorSala.has(video.sala)) {
        resumenPorSala.set(video.sala, { eliminados: 0, errores: 0 });
      }
      resumenPorSala.get(video.sala)!.eliminados++;
    });
    
    erroresEliminacion.forEach(error => {
      if (!resumenPorSala.has(error.sala)) {
        resumenPorSala.set(error.sala, { eliminados: 0, errores: 0 });
      }
      resumenPorSala.get(error.sala)!.errores++;
    });
    
    agregarLinea(`\n📊 RESUMEN POR SALA:`);
    resumenPorSala.forEach((stats, salaId) => {
      agregarLinea(`   Sala ${salaId}: ${stats.eliminados} eliminados, ${stats.errores} errores`);
    });
    
    if (erroresEliminacion.length > 0) {
      agregarLinea(`\n⚠️ VIDEOS CONSERVADOS POR ERRORES:`);
      erroresEliminacion.forEach(error => {
        agregarLinea(`   - ${error.archivo} (Sala ${error.sala}, Orden ${error.orden}): ${error.error}`);
      });
    }
    
    agregarLinea(`=== FIN ELIMINACIÓN RANGO FECHAS ===\n`);

    const fechaReporte = new Date().toISOString().replace(/[:.]/g, '-');
    const nombreArchivo = `reporte-duplicados-${fechaInicio}-${fechaFin}-${fechaReporte}.txt`;
    const contenidoReporte = reporteLineas.join('\n');


   try {

      await this.subirReporteAR2(nombreArchivo, contenidoReporte);
      agregarLinea(`📄 Reporte subido a R2: ${nombreArchivo}`);
      
      return {
        message: `Eliminación rango ${fechaInicio} - ${fechaFin}: ${videosEliminados.length} duplicados eliminados dentro de ${resumenPorSala.size} salas`,
        rango: { fechaInicio, fechaFin },
        horaZona: 'Perú (UTC-5)',
        logica: 'Eliminación de duplicados por sala (videos con misma duración dentro de la misma sala)',
        estadisticas: {
          videosAnalizados: videosConDuracion.length,
          gruposDuplicados: totalGruposDuplicados,
          videosEliminados: videosEliminados.length,
          videosConservados: erroresEliminacion.length,
          salasProcesadas: salaStats.size,
          salasConDuplicados: resumenPorSala.size
        },
        videosEliminados,
        videosConservados: erroresEliminacion,
        resumenPorSala: Array.from(resumenPorSala.entries()).map(([salaId, stats]) => ({
          salaId,
          videosEliminados: stats.eliminados,
          videosConservados: stats.errores,
          videosOriginales: salaStats.get(salaId) || 0
        })),
        archivo: {
          nombre: nombreArchivo,
          urlDescarga: `/sala/descargar-reporte/${nombreArchivo}`,
          urlDirectaR2: `${process.env.R2_PUBLIC_BASE_URL}/reportes/${nombreArchivo}`,
          tamaño: contenidoReporte.length,
          almacenamiento: 'Cloudflare R2'
        },
        politicaSeguridad: 'Si falla R2, el video se conserva en BD'
      };
      
    } catch (error) {
      console.error('Error subiendo reporte a R2:', error.message);
      

      return {
        message: `Eliminación rango ${fechaInicio} - ${fechaFin}: ${videosEliminados.length} duplicados eliminados`,
        rango: { fechaInicio, fechaFin },
        estadisticas: {
          videosAnalizados: videosConDuracion.length,
          videosEliminados: videosEliminados.length,
          salasProcesadas: salaStats.size
        },
        videosEliminados,
        videosConservados: erroresEliminacion,
        reporte: {
          contenido: contenidoReporte,
          error: 'No se pudo subir a R2, reporte incluido en respuesta'
        }
      };
    }
  }

  private convertirFechaPeruAUTC(fecha: string, hora: string): string {

    const fechaHoraLocal = `${fecha} ${hora}`;
    const fechaLocal = new Date(fechaHoraLocal);
    
    const fechaUTC = new Date(fechaLocal.getTime() + (5 * 60 * 60 * 1000));
    
    return fechaUTC.toISOString().replace('T', ' ').substring(0, 19);
  }

  private convertirUTCAFechaPeruString(fechaUTC: Date): string {
    const fechaPeru = new Date(fechaUTC.getTime() - (5 * 60 * 60 * 1000));
    return fechaPeru.toISOString().replace('T', ' ').substring(0, 19) + ' (Perú)';
  }

  private async eliminarDeCloudflareR2(nombreArchivo: string): Promise<void> {
    const s3 = new S3({
      endpoint: process.env.R2_ENDPOINT_URL,
      accessKeyId: process.env.R2_ACCESS_KEY,
      secretAccessKey: process.env.R2_SECRET_KEY,
      region: 'auto',
      signatureVersion: 'v4',
      s3ForcePathStyle: true 
    });

    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) {
      throw new Error('R2_BUCKET_NAME environment variable is not set');
    }
    
    const key = `Multimedia/Video/Cursos/ModulosVivo/${nombreArchivo}`;
    
    console.log(`   🔗 Eliminando de R2: ${key}`);
    
    try {
      await s3.deleteObject({ 
        Bucket: bucket, 
        Key: key 
      }).promise();
      
      console.log(`   ✅ Archivo eliminado exitosamente de R2`);
    } catch (error) {
      console.log(`   ❌ Error eliminando de R2:`, error.message);
      throw error;
    }
  }


  private async subirReporteAR2(nombreArchivo: string, contenido: string): Promise<void> {
    const s3 = new S3({
      endpoint: process.env.R2_ENDPOINT_URL,
      accessKeyId: process.env.R2_ACCESS_KEY,
      secretAccessKey: process.env.R2_SECRET_KEY,
      region: 'auto',
      signatureVersion: 'v4',
      s3ForcePathStyle: true
    });

    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) {
      throw new Error('R2_BUCKET_NAME environment variable is not set');
    }
    
    const key = `reportes/${nombreArchivo}`;
    
    console.log(`📄 Subiendo reporte a R2: ${key}`);
    
    try {
      await s3.upload({
        Bucket: bucket,
        Key: key,
        Body: contenido,
        ContentType: 'text/plain; charset=utf-8',
        ACL: 'public-read'
      }).promise();
      
      console.log(`✅ Reporte subido exitosamente a R2`);
    } catch (error) {
      console.log(`❌ Error subiendo reporte a R2:`, error.message);
      throw error;
    }
  }


  async obtenerReporteDesdeR2(nombreArchivo: string): Promise<string> {
    const s3 = new S3({
      endpoint: process.env.R2_ENDPOINT_URL,
      accessKeyId: process.env.R2_ACCESS_KEY,
      secretAccessKey: process.env.R2_SECRET_KEY,
      region: 'auto',
      signatureVersion: 'v4',
      s3ForcePathStyle: true
    });

    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) {
      throw new Error('R2_BUCKET_NAME environment variable is not set');
    }
    
    const key = `ReporteVideosVivo/${nombreArchivo}`;
    
    try {
      const result = await s3.getObject({
        Bucket: bucket,
        Key: key
      }).promise();
      
      return result.Body?.toString('utf-8') || '';
      
    } catch (error) {
      throw new Error(`Reporte no encontrado: ${nombreArchivo}`);
    }
  }

  async listarReportesDesdeR2() {
    const s3 = new S3({
      endpoint: process.env.R2_ENDPOINT_URL,
      accessKeyId: process.env.R2_ACCESS_KEY,
      secretAccessKey: process.env.R2_SECRET_KEY,
      region: 'auto',
      signatureVersion: 'v4',
      s3ForcePathStyle: true
    });

    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) {
      throw new Error('R2_BUCKET_NAME environment variable is not set');
    }
    
    try {
      const result = await s3.listObjects({
        Bucket: bucket,
        Prefix: 'reportes/',
        MaxKeys: 100
      }).promise();
      
      const reportes = (result.Contents || [])
        .filter(obj => obj.Key?.endsWith('.txt'))
        .map(obj => ({
          nombre: obj.Key?.replace('reportes/', '') || '',
          tamaño: obj.Size || 0,
          fechaModificacion: obj.LastModified || new Date(),
          urlDescarga: `/sala/descargar-reporte/${obj.Key?.replace('reportes/', '')}`,
          urlDirectaR2: `${process.env.R2_PUBLIC_BASE_URL}/${obj.Key}`
        }))
        .sort((a, b) => b.fechaModificacion.getTime() - a.fechaModificacion.getTime());
      
      return {
        message: `${reportes.length} reportes encontrados en R2`,
        reportes
      };
      
    } catch (error) {
      return {
        message: 'Error al listar reportes desde R2',
        error: error.message,
        reportes: []
      };
    }
  }

}