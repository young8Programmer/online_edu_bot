import { Injectable, forwardRef, Inject, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramService } from '../../telegram/telegram.service';
import { I18nService } from '../../i18n/i18n.service';
import { UserService } from '../../user/user.service';
import { QuizService } from '../../quiz/quiz.service';
import { CertificateService } from '../../certificate/certificate.service';
import { CourseService } from '../../course/course.service';
import { ProgressService } from '../../progress/progress.service';
import { LessonService } from '../../lesson/lesson.service';
import { StartQuizHandler } from './start-quiz.handler';

@Injectable()
export class SubmitQuizHandler {
  private readonly logger = new Logger(SubmitQuizHandler.name);

  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly quizService: QuizService,
    private readonly certificateService: CertificateService,
    private readonly courseService: CourseService,
    private readonly progressService: ProgressService,
    private readonly lessonService: LessonService,
    @Inject(forwardRef(() => StartQuizHandler))
    private readonly startQuizHandler: StartQuizHandler,
  ) {}

  async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id.toString();
    let language = 'uz'; // Default til

    try {
      const user = await this.userService.findByTelegramId(telegramId);
      language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

      if (!user) {
        await this.sendError(chatId, telegramId, 'errors.user_not_found', language);
        return;
      }

      const data = query.data;
      if (!data.startsWith('submit_quiz_')) {
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const parts = data.split('_');
      const quizId = parseInt(parts[2], 10);
      const questionIndex = parseInt(parts[3], 10);
      const selectedAnswer = parseInt(parts[4], 10);

      if ([quizId, questionIndex, selectedAnswer].some(isNaN)) {
        await this.sendError(chatId, telegramId, 'errors.invalid_input', language);
        return;
      }

      const quiz = await this.quizService.findById(quizId);
      if (!quiz || !quiz.questions || !Array.isArray(quiz.questions)) {
        await this.sendError(chatId, telegramId, 'errors.quiz_not_found', language);
        return;
      }

      const question = quiz.questions[questionIndex];
      if (
        !question ||
        !question.options ||
        !Array.isArray(question.options) ||
        typeof question.correct !== 'number'
      ) {
        await this.sendError(chatId, telegramId, 'errors.quiz_data_invalid', language);
        return;
      }

      // Submit the answer
      await this.startQuizHandler.submitQuestion(telegramId, quizId, questionIndex, selectedAnswer, bot, chatId, language);

      // Sertifikat va progressni tekshirish
      if (questionIndex + 1 >= quiz.questions.length && quiz.lesson) {
        const state = this.startQuizHandler.getQuizState(telegramId);
        const result = await this.quizService.submitQuiz(telegramId, quizId, state?.answers || []);
        const percentage = result.score / quiz.questions.length;

        if (percentage >= 0.6) {
          await this.progressService.updateProgressAfterQuiz(telegramId, quiz.lesson.id);

          const lessons = await this.lessonService.findByCourseId(quiz.course.id);
          const completedLessonIds = await this.progressService.getCompletedLessonIds(telegramId, quiz.course.id);

          this.logger.log(`Completed Lesson IDs: ${completedLessonIds}, Total Lessons: ${lessons.length}`);

          if (completedLessonIds.length === lessons.length) {
            const certificate = await this.certificateService.createCertificate(telegramId, quiz.course.id);
            await bot.sendDocument(chatId, certificate.pdfBuffer, {
              filename: `certificate_${quiz.course.id}_${telegramId}.pdf`,
              content_type: 'application/pdf',
              caption: this.escapeMarkdown(
                this.i18nService.getTranslation('certificates.certificate_caption', language, {
                  title: quiz.course.title[language],
                }),
              ),
              parse_mode: 'MarkdownV2',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)),
                      callback_data: 'list_courses',
                    },
                  ],
                ],
              },
            });
          } else {
            const nextLesson = await this.progressService.getNextLesson(telegramId, quiz.lesson.id);
            this.logger.log(`Next Lesson: ${nextLesson ? nextLesson.id : 'null'}`);

            if (nextLesson) {
              const lessonInfo = this.escapeMarkdown(
                this.i18nService.getTranslation('lessons.info', language, {
                  title: nextLesson.title[language],
                  content: nextLesson.contentUrl || 'Mazmun mavjud emas',
                })
              );

              await bot.sendMessage(chatId, lessonInfo, {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                  inline_keyboard: [
                    [{
                      text: this.escapeMarkdown(this.i18nService.getTranslation('quizzes.start', language)),
                      callback_data: `start_quiz_lesson_${nextLesson.id}_${quiz.course.id}`,
                    }],
                    [{
                      text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)),
                      callback_data: `list_lessons_${quiz.course.id}`,
                    }],
                  ],
                },
              });
            } else {
              await bot.sendMessage(
                chatId,
                this.escapeMarkdown(this.i18nService.getTranslation('quizzes.no_more_lessons', language)),
                {
                  parse_mode: 'MarkdownV2',
                  reply_markup: {
                    inline_keyboard: [
                      [{
                        text: this.escapeMarkdown(this.i18nService.getTranslation('lessons.list', language)),
                        callback_data: `list_lessons_${quiz.course.id}`,
                      }],
                    ],
                  },
                },
              );
            }
          }
        }
      }

      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      this.logger.error(
        `Error submitting question for telegramId: ${telegramId}, quizId: ${query.data}, error: ${error.message}`,
      );
      await this.sendError(chatId, telegramId, 'errors.server_error', language);
      await bot.answerCallbackQuery(query.id, {
        text: this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', language)),
      });
    }
  }

  private async sendError(chatId: number, telegramId: string, key: string = 'errors.server_error', language: string = 'uz') {
    await this.telegramService.sendMessageWithMenu(
      chatId,
      this.escapeMarkdown(this.i18nService.getTranslation(key, language)),
      language,
      telegramId,
    );
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }
}