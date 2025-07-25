import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/user/user.entity';
import { Course } from '../modules/course/course.entity';
import { Lesson } from '../modules/lesson/lesson.entity';
import { Progress } from '../modules/progress/progress.entity';
import { Quiz } from '../modules/quiz/quiz.entity';
import { QuizResult } from '../modules/quiz/quiz-result.entity';
import { Certificate } from '../modules/certificate/certificate.entity';
import { Payment } from '../modules/payment/payment.entity';
import { Admin } from '../modules/auth/auth.entity';

export const databaseConfig = async (configService: ConfigService): Promise<TypeOrmModuleOptions> => ({
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: parseInt(configService.get('DB_PORT', '5432'), 10),
  username: configService.get('DB_USERNAME', 'postgres'),
  password: configService.get('DB_PASSWORD', '1234'),
  database: configService.get('DB_NAME', 'botbot'),
  entities: [User, Course, Lesson, Progress, Quiz, QuizResult, Certificate, Payment, Admin],
  synchronize: true,
});
