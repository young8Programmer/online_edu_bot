import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Quiz } from './quiz.entity';
import { QuizResult } from './quiz-result.entity';
import { UserService } from '../user/user.service';
import { CourseService } from '../course/course.service';
import { LessonService } from '../lesson/lesson.service';
import { CertificateService } from '../certificate/certificate.service';

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz)
    public readonly quizRepository: Repository<Quiz>,
    @InjectRepository(QuizResult)
    public readonly quizResultRepository: Repository<QuizResult>,
    private readonly userService: UserService,
    private readonly lessonService: LessonService,
    private readonly certificateService: CertificateService,
    private readonly courseService: CourseService,
  ) {}

  async findByCourseId(courseId: number): Promise<Quiz[]> {
    const quizzes = await this.quizRepository.find({
      where: { course: { id: courseId } },
      relations: ['lesson', 'course'],
    });
    return quizzes.length ? quizzes : [];
  }

  async findByLessonId(lessonId: number): Promise<Quiz | null> {
    const quiz = await this.quizRepository.findOne({
      where: { lesson: { id: lessonId } },
      relations: ['course', 'lesson'],
    });
    return quiz;
  }

  async findById(id: number): Promise<Quiz | null> {
    const quiz = await this.quizRepository.findOne({
      where: { id },
      relations: ['course', 'lesson'],
    });
    return quiz;
  }

  async findGeneralQuizzes(): Promise<Quiz[]> {
  return this.quizRepository.find({
    where: {
      course: IsNull(),
      lesson: IsNull(),
    },
    relations: ['questions'],
  });
}

  async createQuiz(data: {
    courseId?: number;
    lessonId?: number;
    questions: Array<{
      question: { uz: string; ru: string; en: string };
      options: Array<{ uz: string; ru: string; en: string }>;
      correct: number;
    }>;
  }): Promise<Quiz> {
    let course, lesson;
    if (data.courseId) {
      course = await this.courseService.findById(data.courseId);
      if (!course) throw new NotFoundException('Course not found');
    }
    if (data.lessonId) {
      lesson = await this.lessonService.findById(data.lessonId);
      if (!lesson) throw new NotFoundException('Lesson not found');
    }

    const quiz = this.quizRepository.create({
      course: course ?? undefined,
      lesson: lesson ?? undefined,
      questions: data.questions,
    });

    return this.quizRepository.save(quiz);
  }

  async createQuizzes(data: Array<{
    courseId?: number;
    lessonId?: number;
    questions: Array<{
      question: { uz: string; ru: string; en: string };
      options: Array<{ uz: string; ru: string; en: string }>;
      correct: number;
    }>;
  }>): Promise<Quiz[]> {
    const quizzes = await Promise.all(
      data.map(async (item) => {
        let course, lesson;
        if (item.courseId) {
          course = await this.courseService.findById(item.courseId);
          if (!course) throw new NotFoundException('Course not found');
        }
        if (item.lessonId) {
          lesson = await this.lessonService.findById(item.lessonId);
          if (!lesson) throw new NotFoundException('Lesson not found');
        }
        return this.quizRepository.create({
          course: course ?? undefined,
          lesson: lesson ?? undefined,
          questions: item.questions,
        });
      }),
    );
    return this.quizRepository.save(quizzes);
  }

  async updateQuiz(id: number, data: {
    questions?: Array<{
      question: { uz: string; ru: string; en: string };
      options: Array<{ uz: string; ru: string; en: string }>;
      correct: number;
    }>;
  }): Promise<void> {
    const quiz = await this.findById(id);
    if (!quiz) throw new NotFoundException('Quiz not found');
    await this.quizRepository.update(id, data);
  }

  async deleteQuiz(id: number): Promise<void> {
    const quiz = await this.findById(id);
    if (!quiz) throw new NotFoundException('Quiz not found');
    await this.quizResultRepository.delete({ quiz: { id } });
    await this.quizRepository.delete(id);
  }

  async submitQuiz(telegramId: string, quizId: number, answers: number[]): Promise<{ score: number; total: number; explanations: string[] }> {
    const user = await this.userService.findByTelegramId(telegramId);
    const quiz = await this.findById(quizId);
    if (!user || !quiz) throw new NotFoundException('User or Quiz not found');

    let score = 0;
    const explanations: string[] = [];

    quiz.questions.forEach((q, index) => {
      const selectedAnswer = answers[index];
      const isCorrect = selectedAnswer === q.correct;
      if (isCorrect) {
        score++;
      } else if (selectedAnswer !== undefined) {
        const lang = user.language || 'uz';
        explanations.push(
          this.escapeMarkdown(
            `Question ${index + 1}\\. Correct answer: ${q.options[lang][q.correct]}`,
          ),
        );
      }

      if (selectedAnswer !== undefined) {
        const result = this.quizResultRepository.create({
          user,
          quiz,
          selectedAnswer,
          isCorrect,
        });
        this.quizResultRepository.save(result);
      }
    });

    return { score, total: quiz.questions.length, explanations };
  }

  async canAccessQuiz(telegramId: string, courseId: number, lessonId?: number): Promise<boolean> {
    if (!lessonId) return this.courseService.canAccessCourse(telegramId, courseId);
    const lesson = await this.lessonService.findById(lessonId);
    if (!lesson) return false;
    return this.lessonService.canAccessLesson(telegramId, lessonId);
  }

  async getResults(telegramId: string, courseId: number): Promise<QuizResult[]> {
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) throw new NotFoundException('User not found');
    const query = this.quizResultRepository
      .createQueryBuilder('quizResult')
      .leftJoinAndSelect('quizResult.quiz', 'quiz')
      .leftJoinAndSelect('quiz.course', 'course')
      .where('quizResult.userId = :userId', { userId: user.id });

    if (courseId) {
      query.andWhere('quiz.courseId = :courseId', { courseId });
    }

    return query.getMany();
  }

  async resetQuizResults(telegramId: string, courseId: number): Promise<void> {
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) throw new NotFoundException('User not found');
    const quizIds = await this.quizRepository
      .createQueryBuilder('quiz')
      .select('quiz.id')
      .where('quiz.courseId = :courseId', { courseId })
      .getMany();
    const quizIdList = quizIds.map((q) => q.id);
    if (quizIdList.length === 0) return;
    await this.quizResultRepository
      .createQueryBuilder()
      .delete()
      .where('"userId" = :userId', { userId: user.id })
      .andWhere('"quizId" IN (:...quizIds)', { quizIds: quizIdList })
      .execute();
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+-=\|\{\}\s.!?])/g, '\\$1');
  }
}