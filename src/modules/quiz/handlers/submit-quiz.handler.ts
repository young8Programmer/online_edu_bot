import { Injectable, forwardRef, Inject, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramService } from '../../telegram/telegram.service';
import { I18nService } from '../../i18n/i18n.service';
import { UserService } from '../../user/user.service';
import { QuizService } from '../../quiz/quiz.service';
import { CertificateService } from '../../certificate/certificate.service';
import { CourseService } from '../../course/course.service';
import { ProgressService } from '../../progress/progress.service';
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
    @Inject(forwardRef(() => StartQuizHandler))
    private readonly startQuizHandler: StartQuizHandler,
  ) {}

  async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id.toString();
    this.logger.log(`Handling callback for telegramId: ${telegramId}, data: ${query.data}`);

    try {
      const user = await this.userService.findByTelegramId(telegramId);
      const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

      if (!user) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.user_not_found', language)),
          language,
          telegramId,
        );
        await bot.answerCallbackQuery(query.id);
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

      if (isNaN(quizId) || isNaN(questionIndex) || isNaN(selectedAnswer)) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.invalid_input', language)),
          language,
          telegramId,
        );
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const quiz = await this.quizService.findById(quizId);
      if (!quiz) {
        await this.telegramService.sendMessageWithMenu(
          chatId,
          this.escapeMarkdown(this.i18nService.getTranslation('errors.quiz_not_found', language)),
          language,
          telegramId,
        );
        await bot.answerCallbackQuery(query.id);
        return;
      }

      await this.startQuizHandler.submitQuestion(telegramId, quizId, questionIndex, selectedAnswer, bot, chatId, language);

      // Sertifikat va progressni yangilash
      if (questionIndex + 1 >= quiz.questions.length && quiz.lesson) {
        const result = await this.quizService.submitQuiz(telegramId, quizId, []);
        if (result.score / quiz.questions.length >= 0.6) {
          await this.progressService.updateProgressAfterQuiz(telegramId, quiz.lesson.id);
          const progress = await this.progressService.checkCourseCompletion(telegramId, quiz.course.id);
          if (progress.completed === progress.total) {
            const certificate = await this.certificateService.createCertificate(telegramId, quiz.course.id);
            await bot.sendDocument(chatId, certificate.pdfBuffer, {
              filename: `certificate_${quiz.course.id}_${telegramId}.pdf`,
              content_type: 'application/pdf',
              caption: this.escapeMarkdown(
                this.i18nService.getTranslation('certificates.certificate_caption', language, { title: quiz.course.title[language] }),
              ),
              parse_mode: 'MarkdownV2',
              reply_markup: {
                inline_keyboard: [[{ text: this.escapeMarkdown(this.i18nService.getTranslation('courses.back', language)), callback_data: 'list_courses' }]],
              },
            });
          } else {
            await bot.sendMessage(
              chatId,
              this.escapeMarkdown(this.i18nService.getTranslation('quizzes.next_lesson_unlocked', language)),
              {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: this.escapeMarkdown(this.i18nService.getTranslation('lessons.list', language)), callback_data: `list_lessons_${quiz.course.id}` }],
                  ],
                },
              },
            );
          }
        }
      }

      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', 'uz')),
        'uz',
        telegramId,
      );
      await bot.answerCallbackQuery(query.id, { text: this.escapeMarkdown(this.i18nService.getTranslation('errors.server_error', 'uz')) });
    }
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([_*[\]()~`>#+-=\|\{\}\s.!?])/g, '\\$1');
  }
}