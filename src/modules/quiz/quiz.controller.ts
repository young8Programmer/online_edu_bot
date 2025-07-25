import { Controller, Get, Param, Post, Body, Delete } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { Quiz } from './quiz.entity';

@Controller('quizzes')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('course/:courseId')
  async findByCourseId(@Param('courseId') courseId: string): Promise<Quiz[]> {
    return this.quizService.findByCourseId(parseInt(courseId, 10));
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Quiz | null> {
    return this.quizService.findById(parseInt(id, 10));
  }

  @Post()
  async create(@Body() data: {
    courseId: number;
    lessonId?: number;
    questions: Array<{
      question: { uz: string; ru: string; en: string };
      options: Array<{ uz: string; ru: string; en: string }>;
      correct: number;
    }>;
  }): Promise<Quiz> {
    return this.quizService.createQuiz(data);
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() data: {
    questions?: Array<{
      question: { uz: string; ru: string; en: string };
      options: Array<{ uz: string; ru: string; en: string }>;
      correct: number;
    }>;
  }): Promise<void> {
    await this.quizService.updateQuiz(parseInt(id, 10), data);
  }

  @Post('submit')
  async submit(@Body() body: { telegramId: string; quizId: number; answers: number[] }): Promise<{ score: number; total: number; explanations: string[] }> {
    return this.quizService.submitQuiz(body.telegramId, body.quizId, body.answers);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.quizService.deleteQuiz(parseInt(id, 10));
  }
}