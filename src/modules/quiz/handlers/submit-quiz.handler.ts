import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { TelegramBot } from 'node-telegram-bot-api';
import { TelegramService } from '../../telegram/telegram.service';
import { I18nService } from '../../i18n/i18n.service';
import { UserService } from '../../user/user.service';
import { QuizService } from '../../quiz/quiz.service';
import { CertificateService } from '../../certificate/certificate.service';
import { CourseService } from '../../course/course.service';

@Injectable()
export class SubmitQuizHandler {
  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly quizService: QuizService,
    private readonly certificateService: CertificateService,
    private readonly courseService: CourseService,
  ) {}

  async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id.toString();

    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.i18nService.getTranslation('errors.user_not_found', language),
        language,
        telegramId,
      );
      return this.safeAnswerCallback(bot, query.id);
    }

    const data = query.data;
    if (!data?.startsWith('submit_quiz_')) return;

    const parts = data.split('_');
    if (parts.length !== 4) {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.i18nService.getTranslation('errors.invalid_input', language),
        language,
        telegramId,
      );
      return this.safeAnswerCallback(bot, query.id);
    }

    const quizId = parseInt(parts[2], 10);
    const selectedAnswer = parseInt(parts[3], 10);

    if (isNaN(quizId) || isNaN(selectedAnswer)) {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.i18nService.getTranslation('errors.invalid_input', language),
        language,
        telegramId,
      );
      return this.safeAnswerCallback(bot, query.id);
    }

    const quiz = await this.quizService.findById(quizId);
    if (!quiz) {
      await this.telegramService.sendMessageWithMenu(
        chatId,
        this.i18nService.getTranslation('errors.quiz_not_found', language),
        language,
        telegramId,
      );
      return this.safeAnswerCallback(bot, query.id);
    }

    const { isCorrect, correctAnswer } = await this.quizService.submitQuiz(telegramId, quizId, selectedAnswer);

    const quizText =
      `${quiz.question[language]}\n\n` +
      quiz.options[language]
        .map((option: string, index: number) => {
          const symbol = index === selectedAnswer ? (isCorrect ? '✅' : '❌') : index === correctAnswer ? '✅' : '';
          return `${index + 1}. ${option} ${symbol}`;
        })
        .join('\n');

    const keyboard = {
      reply_markup: {
        inline_keyboard: quiz.options[language].map((option: string, index: number) => [
          {
            text: `${option} ${index === selectedAnswer ? (isCorrect ? '✅' : '❌') : index === correctAnswer ? '✅' : ''}`,
            callback_data: `noop_${quizId}_${index}`,
          },
        ]),
      },
    };

    await bot.editMessageText(quizText, {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'Markdown',
      ...keyboard,
    });

    const courseId = quiz.course.id;
    const quizzes = await this.quizService.findByCourseId(courseId);
    const results = await this.quizService.getResults(telegramId, courseId);
    const completedQuizIds = results.map((r) => r.quiz.id);
    const nextQuiz = quizzes.find((q) => !completedQuizIds.includes(q.id));

    if (nextQuiz) {
      setTimeout(() => this.showQuiz(bot, chatId, nextQuiz, language), 1000);
    } else {
      const correctCount = results.filter((r) => r.isCorrect).length;
      const score = (correctCount / quizzes.length) * 100;

      if (score >= 60) {
        const course = await this.courseService.findById(courseId);
        if (!course) {
          await this.telegramService.sendMessageWithMenu(
            chatId,
            this.i18nService.getTranslation('errors.course_not_found', language),
            language,
            telegramId,
          );
          return this.safeAnswerCallback(bot, query.id);
        }

        try {
          const certificate = await this.certificateService.createCertificate(telegramId, courseId);
          if (!certificate.pdfBuffer || certificate.pdfBuffer.length === 0) {
            throw new Error('Certificate PDF buffer is empty or invalid');
          }

          await bot.sendDocument(chatId, certificate.pdfBuffer, {
            filename: `certificate_${courseId}_${telegramId}.pdf`,
            content_type: 'application/pdf',
            caption: this.i18nService.getTranslation('certificates.certificate_caption', language, {
              title: course.title[language],
            }),
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: this.i18nService.getTranslation('courses.back', language),
                    callback_data: 'list_courses',
                  },
                ],
              ],
            },
          });
        } catch (err) {
          console.error('❌ Certificate generation error:', err);
          await bot.sendMessage(chatId, this.i18nService.getTranslation('certificates.error', language));
        }
      } else {
        await bot.sendMessage(
          chatId,
          this.i18nService.getTranslation('quizzes.all_completed', language),
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: this.i18nService.getTranslation('quizzes.restart', language),
                    callback_data: `restart_quiz_course_${courseId}`,
                  },
                ],
                [
                  {
                    text: this.i18nService.getTranslation('courses.back', language),
                    callback_data: 'list_courses',
                  },
                ],
              ],
            },
          },
        );
      }
    }

    await this.safeAnswerCallback(bot, query.id);
  }

  private async safeAnswerCallback(bot: TelegramBot, callbackId: string) {
    try {
      await bot.answerCallbackQuery(callbackId);
    } catch (error) {
      console.error(`❗️ answerCallbackQuery error: ${error.message}`);
    }
  }

  private async showQuiz(bot: TelegramBot, chatId: number, quiz, language: string) {
    const questionText =
      `${quiz.question[language]}\n\n` +
      quiz.options[language].map((option: string, index: number) => `${index + 1}. ${option}`).join('\n');

    const keyboard = {
      reply_markup: {
        inline_keyboard: quiz.options[language].map((option: string, index: number) => [
          {
            text: option,
            callback_data: `submit_quiz_${quiz.id}_${index}`,
          },
        ]),
      },
    };

    await bot.sendMessage(chatId, questionText, keyboard);
  }
}