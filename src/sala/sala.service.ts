import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

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

}