import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz } from './quiz.entity';
import { QuizResult } from './quiz-result.entity';
import { UserService } from '../user/user.service';
import { CourseService } from '../course/course.service';

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,
    @InjectRepository(QuizResult)
    private readonly quizResultRepository: Repository<QuizResult>,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
  ) {}

  async findByCourseId(courseId: number): Promise<Quiz[]> {
    return this.quizRepository.find({ where: { course: { id: courseId } } });
  }

  async findById(id: number): Promise<Quiz | null> {
    return this.quizRepository.findOne({ where: { id }, relations: ['course'] });
  }

  async createQuiz(data: {
    courseId: number;
    question: { uz: string; ru: string; en: string };
    options: { uz: string[]; ru: string[]; en: string[] };
    correctAnswer: number;
  }): Promise<Quiz> {
    const course = await this.courseService.findById(data.courseId);
    if (!course) {
      throw new Error('Kurs topilmadi');
    }
    const quiz = this.quizRepository.create({
      course,
      question: data.question,
      options: data.options,
      correctAnswer: data.correctAnswer,
    });
    return this.quizRepository.save(quiz);
  }

  async updateQuiz(id: number, data: {
    question: { uz: string; ru: string; en: string };
    options: { uz: string[]; ru: string[]; en: string[] };
    correctAnswer: number;
  }): Promise<void> {
    const quiz = await this.findById(id);
    if (!quiz) {
      throw new Error('Quiz topilmadi');
    }
    await this.quizRepository.update(id, data);
  }

  async deleteQuiz(id: number): Promise<void> {
    const quiz = await this.findById(id);
    if (!quiz) {
      throw new Error('Quiz topilmadi');
    }
    await this.quizResultRepository.delete({ quiz: { id } });
    await this.quizRepository.delete(id);
  }

  async submitQuiz(telegramId: string, quizId: number, selectedAnswer: number): Promise<{ isCorrect: boolean; correctAnswer: number }> {
    const user = await this.userService.findByTelegramId(telegramId);
    const quiz = await this.findById(quizId);
    if (!user || !quiz) {
      throw new Error('Foydalanuvchi yoki test topilmadi');
    }
    const isCorrect = selectedAnswer === quiz.correctAnswer;
    const quizResult = this.quizResultRepository.create({
      user,
      quiz,
      selectedAnswer,
      isCorrect,
    });
    await this.quizResultRepository.save(quizResult);
    return { isCorrect, correctAnswer: quiz.correctAnswer };
  }

  async canAccessQuiz(telegramId: string, courseId: number): Promise<boolean> {
    return this.courseService.canAccessCourse(telegramId, courseId);
  }

  async getResults(telegramId: string, courseId: number): Promise<QuizResult[]> {
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) {
      throw new Error('Foydalanuvchi topilmadi');
    }
    return this.quizResultRepository.find({
      where: { user: { id: user.id }, quiz: { course: { id: courseId } } },
      relations: ['quiz'],
    });
  }
}