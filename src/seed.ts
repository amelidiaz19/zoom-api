// src/database/seed.ts
import { Sequelize } from 'sequelize-typescript';
import * as dotenv from 'dotenv';
import { Tag } from './zoom/models/tag.model';
import { ZoomMeeting } from './zoom/models/zoom-meeting.model';

dotenv.config();

export const seedData = async () => {
  const sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST,
    port: +(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    models: [Tag, ZoomMeeting],
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } ,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });

  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const countTags = await Tag.count();

    if (countTags > 0) {
      return { message: 'Tags ya fueron insertados anteriormente.' };
    }

    await Tag.bulkCreate([
      { nombre: 'ccd' },
      { nombre: 'digital' }
    ]);

    console.log('✅ Tags iniciales insertados correctamente');
  } catch (error) {
    console.error('❌ Error ejecutando el seed de Tags:', error);
    process.exit(1);
  } finally {
    //await sequelize.close();
  }
};

seedData();
