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
  async findById(@Param('id') id: string): Promise<Quiz> {
    const quiz = await this.quizService.findById(parseInt(id, 10));
    if (!quiz) {
      throw new Error('Quiz topilmadi');
    }
    return quiz;
  }

  @Post()
  async create(@Body() data: { courseId: number; question: { uz: string; ru: string; en: string }; options: { uz: string[]; ru: string[]; en: string[] }; correctAnswer: number }): Promise<Quiz> {
    return this.quizService.createQuiz(data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.quizService.deleteQuiz(parseInt(id, 10));
  }
}