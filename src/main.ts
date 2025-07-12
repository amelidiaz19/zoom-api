// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { seedData } from './seed'; // 👈 Ejecuta automáticamente el seed
import { Sequelize } from 'sequelize-typescript';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ⚙️ Configuración de sincronización controlada por .env
  const alter = process.env.ALTER === 'true';
  const force = process.env.FORCE === 'true';

  const sequelize = app.get(Sequelize);
  await sequelize.sync({ alter, force }); // 🔁 Sincronizar DB

  // 🌐 Prefijo global
  app.setGlobalPrefix('api');

  // 🛡️ Validaciones globales
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // 📄 Swagger docs
  const config = new DocumentBuilder()
    .setTitle('Zoom API')
    .setDescription('API para reuniones Zoom multi-tag (ccd, digital, egp)')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // 🌍 CORS
  app.enableCors();

  // 🌱 Seed automático
  try {
    const result = await seedData();
    console.log('🌱 Seeding result:', result);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  }

  // 🚀 Escuchar en el puerto
  const port = parseInt(process.env.PORT ?? '', 10) || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Zoom API corriendo en http://localhost:${port}/api`);
}
bootstrap();
