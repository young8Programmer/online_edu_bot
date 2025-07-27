import { Controller, Get, Param, Post, Body, Put, Delete } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { CourseService } from '../course/course.service';
import { LessonService } from '../lesson/lesson.service';
import { Quiz } from './quiz.entity';

@Controller('quizzes')
export class QuizController {
  constructor(
    private readonly quizService: QuizService,
    private readonly courseService: CourseService,
    private readonly lessonService: LessonService,
  ) {}

  // Kurslar ro‘yxatini olish
  @Get('courses')
  async getCourses() {
    return this.courseService.findAll();
  }

  // Kursga tegishli darslar ro‘yxatini olish
  @Get('courses/:courseId/lessons')
  async getLessons(@Param('courseId') courseId: string) {
    return this.lessonService.findByCourseId(parseInt(courseId, 10));
  }

  // Kurs bo‘yicha testlarni olish
  @Get('course/:courseId')
  async findByCourseId(@Param('courseId') courseId: string): Promise<Quiz[]> {
    return this.quizService.findByCourseId(parseInt(courseId, 10));
  }

  // Testni ID bo‘yicha olish
  @Get(':id')
  async findById(@Param('id') id: string): Promise<Quiz | null> {
    return this.quizService.findById(parseInt(id, 10));
  }

  // Aralash testlar ro‘yxatini olish
  @Get('mixed')
  async findMixedQuizzes(): Promise<Quiz[]> {
    return this.quizService.findMixedQuizzes();
  }

  // Yangi test yaratish
  @Post()
  async create(@Body() data: {
    courseId?: number;
    lessonId?: number;
    questions: Array<{
      question: { uz: string; ru: string; en: string };
      options: Array<{ uz: string; ru: string; en: string }>;
      correct: number;
    }>;
  }): Promise<Quiz> {
    return this.quizService.createQuiz(data);
  }

  // Testni yangilash
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: {
    courseId?: number;
    lessonId?: number;
    questions?: Array<{
      question: { uz: string; ru: string; en: string };
      options: Array<{ uz: string; ru: string; en: string }>;
      correct: number;
    }>;
  }): Promise<void> {
    await this.quizService.updateQuiz(parseInt(id, 10), data);
  }

  // Testni topshirish
  @Post('submit')
  async submit(@Body() body: { telegramId: string; quizId: number; answers: number[] }): Promise<{ score: number; total: number; explanations: string[] }> {
    return this.quizService.submitQuiz(body.telegramId, body.quizId, body.answers);
  }

  // Testni o‘chirish
  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.quizService.deleteQuiz(parseInt(id, 10));
  }
}