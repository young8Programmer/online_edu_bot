import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Quiz } from './quiz.entity';
import { QuizResult } from './quiz-result.entity';
import { UserService } from '../user/user.service';
import { CourseService } from '../course/course.service';
import { LessonService } from '../lesson/lesson.service';
import { CertificateService } from '../certificate/certificate.service';
import { Question } from './question.entity';

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz)
    public readonly quizRepository: Repository<Quiz>,
    @InjectRepository(QuizResult)
    public readonly quizResultRepository: Repository<QuizResult>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
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
    return quizzes.filter((quiz) => quiz.questions?.length) || [];
  }

  async findById(id: number): Promise<Quiz | null> {
    const quiz = await this.quizRepository.findOne({
      where: { id },
      relations: ['course', 'lesson'],
    });

    if (!quiz) {
      return null;
    }

    const questions = await this.questionRepository.find({ where: { quiz: { id } } });
    quiz.questions = questions.map((q) => ({
      question: q.question,
      options: Object.values(q.options).map((langOptions) =>
        langOptions.map((opt: string) => ({
          uz: opt,
          ru: opt,
          en: opt,
        })),
      )[0],
      correct: q.correct,
    }));

    if (!quiz.questions || !quiz.questions.length) {
      return null;
    }

    return quiz;
  }

  async findGeneralQuizzes(): Promise<Quiz[]> {
    const quizzes = await this.quizRepository.find({
      where: {
        course: IsNull(),
        lesson: IsNull(),
      },
    });
    return quizzes.filter((quiz) => quiz.questions?.length) || [];
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
      if (data.courseId && lesson.course.id !== data.courseId) {
        throw new NotFoundException('Lesson does not belong to the specified course');
      }
    }

    const quiz = this.quizRepository.create({
      course: course ?? undefined,
      lesson: lesson ?? undefined,
    });

    const savedQuiz = await this.quizRepository.save(quiz);

    for (const q of data.questions) {
      await this.createQuestion(savedQuiz.id, {
        question: q.question,
        options: q.options,
        correct: q.correct,
      });
    }

    return this.findById(savedQuiz.id) as Promise<Quiz>;
  }

  async findByLessonAndCourse(lessonId: number, courseId: number): Promise<Quiz | null> {
    const quiz = await this.quizRepository.findOne({
      where: {
        lesson: { id: lessonId },
        course: { id: courseId },
      },
      relations: ['course', 'lesson'],
    });

    if (!quiz || !quiz.questions || !quiz.questions.length) {
      return null;
    }

    return quiz;
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
    return this.quizRepository.manager.transaction(async (manager) => {
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
            if (item.courseId && lesson.course.id !== item.courseId) {
              throw new NotFoundException('Lesson does not belong to the specified course');
            }
          }
          return this.quizRepository.create({
            course: course ?? undefined,
            lesson: lesson ?? undefined,
            questions: item.questions,
          });
        }),
      );
      return manager.save(Quiz, quizzes);
    });
  }

  async updateQuiz(id: number, data: {
    courseId?: number;
    lessonId?: number;
    questions?: Array<{
      question: { uz: string; ru: string; en: string };
      options: Array<{ uz: string; ru: string; en: string }>;
      correct: number;
    }>;
  }): Promise<void> {
    const quiz = await this.findById(id);
    if (!quiz) throw new NotFoundException('Quiz not found');

    let course, lesson;
    if (data.courseId) {
      course = await this.courseService.findById(data.courseId);
      if (!course) throw new NotFoundException('Course not found');
    }
    if (data.lessonId) {
      lesson = await this.lessonService.findById(data.lessonId);
      if (!lesson) throw new NotFoundException('Lesson not found');
      if (data.courseId && lesson.course.id !== data.courseId) {
        throw new NotFoundException('Lesson does not belong to the specified course');
      }
    }

    await this.quizRepository.update(id, {
      course: course ?? quiz.course,
      lesson: lesson ?? quiz.lesson,
      questions: data.questions ?? quiz.questions,
    });
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
            `Savol ${index + 1}\\. To‘g‘ri javob: ${q.options[q.correct][lang]}`,
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
    if (lesson.course.id !== courseId) {
      throw new NotFoundException(`Lesson ${lessonId} does not belong to course ${courseId}`);
    }
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

  async createQuestion(quizId: number, questionData: {
    question: { uz: string; ru: string; en: string };
    options: Array<{ uz: string; ru: string; en: string }>;
    correct: number;
  }) {
    const question = this.questionRepository.create({
      quiz: { id: quizId },
      question: questionData.question,
      options: {
        uz: questionData.options.map((opt) => opt.uz),
        ru: questionData.options.map((opt) => opt.ru),
        en: questionData.options.map((opt) => opt.en),
      },
      correct: questionData.correct,
    });
    return this.questionRepository.save(question);
  }

  async findByLessonId(lessonId: number): Promise<Quiz | null> {
    const quiz = await this.quizRepository.findOne({
      where: { lesson: { id: lessonId } },
      relations: ['course', 'lesson'],
    });
    return quiz;
  }

  async findAllByLessonId(lessonId: number): Promise<Quiz[]> {
    const lesson = await this.lessonService.findById(lessonId);
    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }
    return this.quizRepository.find({
      where: { lesson: { id: lessonId } },
      relations: ['course', 'lesson'],
    });
  }

  async findMixedQuizzes(): Promise<Quiz[]> {
    const quizzes = await this.quizRepository.find({
      where: {
        course: IsNull(),
        lesson: IsNull(),
      },
    });

    const result = await Promise.all(
      quizzes.map(async (quiz) => {
        const questions = await this.questionRepository.find({ where: { quiz: { id: quiz.id } } });
        quiz.questions = questions.map((q) => ({
          question: q.question,
          options: Object.values(q.options).map((langOptions) =>
            langOptions.map((opt: string) => ({
              uz: opt,
              ru: opt,
              en: opt,
            })),
          )[0],
          correct: q.correct,
        }));
        return quiz;
      }),
    );

    return result.filter((quiz) => quiz.questions?.length) || [];
  }

  async deleteMixedQuiz(id: number): Promise<void> {
    const quiz = await this.findById(id);
    if (!quiz || quiz.course || quiz.lesson) throw new NotFoundException('Mixed quiz not found');
    await this.quizResultRepository.delete({ quiz: { id } });
    await this.questionRepository.delete({ quiz: { id } });
    await this.quizRepository.delete(id);
  }
}