import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { I18nService } from '../../i18n/i18n.service';
import { UserService } from '../../user/user.service';
import { CourseService } from '../../course/course.service';
import { QuizService } from '../../quiz/quiz.service';
import { CertificateService } from '../../certificate/certificate.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class StartQuizHandler {
  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private readonly i18nService: I18nService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly quizService: QuizService,
    private readonly certificateService: CertificateService,
  ) {}

  async handle(msg: TelegramBot.Message, bot: TelegramBot) {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    const courses = await this.courseService.findAll();
    if (!courses.length) {
      await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('courses.no_courses', language), language, telegramId);
      return;
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: courses.map((course) => [
          { text: course.title[language], callback_data: `start_quiz_course_${course.id}` },
        ]),
      },
    };
    await bot.sendMessage(
      chatId,
      this.i18nService.getTranslation('quizzes.list', language),
      keyboard,
    );
  }

  async handleCallback(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const telegramId = query.from.id.toString();
    const user = await this.userService.findByTelegramId(telegramId);
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('errors.user_not_found', language), language, telegramId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const data = query.data;
    if (data.startsWith('start_quiz_course_')) {
      const courseId = parseInt(data.split('_')[3], 10);
      if (isNaN(courseId)) {
        await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('errors.invalid_input', language), language, telegramId);
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const canAccess = await this.quizService.canAccessQuiz(telegramId, courseId);
      if (!canAccess) {
        await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('errors.course_access_denied', language), language, telegramId);
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const quizzes = await this.quizService.findByCourseId(courseId);
      if (!quizzes.length) {
        await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('quizzes.no_quizzes', language), language, telegramId);
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const quiz = quizzes[0];
      const keyboard = {
        reply_markup: {
          inline_keyboard: quiz.options[language].map((option, index) => [
            { text: option, callback_data: `submit_quiz_${quiz.id}_${index}` },
          ]),
        },
      };
      await bot.sendMessage(
        chatId,
        `${quiz.question[language]}\n\n${quiz.options[language].map((option, index) => `${index + 1}. ${option}`).join('\n')}`,
        keyboard,
      );
    } else if (data.startsWith('submit_quiz_')) {
      const [_, quizId, selectedAnswer] = data.split('_').map((v, i) => (i > 0 ? parseInt(v, 10) : v));
      if (isNaN(quizId) || isNaN(selectedAnswer)) {
        await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('errors.invalid_input', language), language, telegramId);
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const quiz = await this.quizService.findById(quizId);
      if (!quiz) {
        await this.telegramService.sendMessageWithMenu(chatId, this.i18nService.getTranslation('errors.quiz_not_found', language), language, telegramId);
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const result = await this.quizService.submitQuiz(telegramId, quizId, selectedAnswer);
      const message = result.isCorrect
        ? this.i18nService.getTranslation('success.correct_answer', language)
        : this.i18nService.getTranslation('errors.incorrect_answer', language, { correctAnswer: quiz.options[language][result.correctAnswer] });

      if (result.isCorrect) {
        const quizResults = await this.quizService.getResults(telegramId, quiz.course.id);
        const totalQuizzes = quizResults.length;
        const correctAnswers = quizResults.filter((r) => r.isCorrect).length;
        const percentage = totalQuizzes > 0 ? (correctAnswers / totalQuizzes) * 100 : 0;

        if (percentage >= 60) {
          const certificate = await this.certificateService.generateCertificate(telegramId, quiz.course.id, language);
          await bot.sendDocument(
            chatId,
            certificate.pdfUrl,
            {
              caption: this.i18nService.getTranslation('certificates.certificate_caption', language, { title: quiz.course.title[language] }),
              reply_markup: {
                inline_keyboard: [[{ text: this.i18nService.getTranslation('courses.back', language), callback_data: 'list_courses' }]],
              },
            },
          );
        }
      }

      await this.telegramService.sendMessageWithMenu(chatId, message, language, telegramId);
    }
    await bot.answerCallbackQuery(query.id);
  }
}