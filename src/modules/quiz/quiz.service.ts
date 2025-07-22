import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz } from './quiz.entity';
import { QuizResult } from './quiz-result.entity';
import { UserService } from '../user/user.service';
import { CourseService } from '../course/course.service';

interface QuizInput {
  question_uz: string;
  question_ru: string;
  question_en: string;
  options_uz: string;
  options_ru: string;
  options_en: string;
  correctAnswer: number;
}

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
    return this.quizRepository.find({ where: { course: { id: courseId } }, relations: ['course'] });
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
    if (data.correctAnswer < 0 || data.correctAnswer >= data.options.uz.length) {
      throw new Error('Noto‘g‘ri to‘g‘ri javob indeksi');
    }
    const quiz = this.quizRepository.create({
      course,
      question: data.question,
      options: data.options,
      correctAnswer: data.correctAnswer,
    });
    return this.quizRepository.save(quiz);
  }

  async createQuizzes(courseId: number, quizzesData: QuizInput[]): Promise<Quiz[]> {
    const course = await this.courseService.findById(courseId);
    if (!course) {
      throw new Error('Kurs topilmadi');
    }
    const quizzes: Quiz[] = [];
    for (const data of quizzesData) {
      const options = {
        uz: data.options_uz.split(',').map(s => s.trim()),
        ru: data.options_ru.split(',').map(s => s.trim()),
        en: data.options_en.split(',').map(s => s.trim()),
      };
      if (data.correctAnswer < 0 || data.correctAnswer >= options.uz.length) {
        throw new Error('Noto‘g‘ri to‘g‘ri javob indeksi');
      }
      const quiz = this.quizRepository.create({
        course,
        question: { uz: data.question_uz, ru: data.question_ru, en: data.question_en },
        options,
        correctAnswer: data.correctAnswer,
      });
      quizzes.push(await this.quizRepository.save(quiz));
    }
    return quizzes;
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
    if (data.correctAnswer < 0 || data.correctAnswer >= data.options.uz.length) {
      throw new Error('Noto‘g‘ri to‘g‘ri javob indeksi');
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
    if (selectedAnswer < 0 || selectedAnswer >= quiz.options.uz.length) {
      throw new Error('Noto‘g‘ri javob indeksi');
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
      relations: ['quiz', 'quiz.course'],
    });
  }

  async resetQuizResults(telegramId: string, courseId: number): Promise<void> {
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) {
      throw new Error('Foydalanuvchi topilmadi');
    }
    const quizIds = await this.quizRepository
      .createQueryBuilder('quiz')
      .select('quiz.id')
      .where('quiz.courseId = :courseId', { courseId })
      .getMany();
    const quizIdList = quizIds.map(q => q.id);
    if (quizIdList.length === 0) return;
    await this.quizResultRepository
      .createQueryBuilder()
      .delete()
      .where('"userId" = :userId', { userId: user.id })
      .andWhere('"quizId" IN (:...quizIds)', { quizIds: quizIdList })
      .execute();
  }
}