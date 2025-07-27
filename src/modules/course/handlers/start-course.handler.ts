import { Injectable } from '@nestjs/common';
import { CourseService } from '../course.service';
import { UserService } from '../../user/user.service';
import { I18nService } from '../../i18n/i18n.service';
import { LessonService } from '../../lesson/lesson.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class StartCourseHandler {
  constructor(
    private readonly courseService: CourseService,
    private readonly userService: UserService,
    private readonly i18nService: I18nService,
    private readonly lessonService: LessonService,
  ) {}

  async handle(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const courseId = parseInt(query.data.split('_')[2], 10);
    const user = await this.userService.findByTelegramId(query.from.id.toString());
    const language = user?.language && ['uz', 'ru', 'en'].includes(user.language) ? user.language : 'uz';

    if (!user) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.user_not_found', language));
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const course = await this.courseService.findById(courseId);
    if (!course) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.course_not_found', language));
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const canAccess = await this.courseService.canAccessCourse(user.telegramId, courseId);
    if (!canAccess) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('errors.course_access_denied', language));
      await bot.answerCallbackQuery(query.id);
      return;
    }

    await this.courseService.enrollUser(user.telegramId, courseId);

    const lessons = await this.lessonService.findByCourseId(courseId);
    if (!lessons.length) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('lessons.no_lessons', language));
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const accessibleLessons = await Promise.all(
      lessons.map(async (lesson) => ({
        ...lesson,
        canAccess: await this.lessonService.canAccessLesson(user.telegramId, lesson.id),
      })),
    ).then((lessons) => lessons.filter((lesson) => lesson.canAccess));

    if (!accessibleLessons.length) {
      await bot.sendMessage(chatId, this.i18nService.getTranslation('lessons.no_accessible_lessons', language));
      await bot.answerCallbackQuery(query.id);
      return;
    }

    const firstLesson = accessibleLessons[0];
    const message = this.i18nService.getTranslation('lessons.info', language, {
      title: firstLesson.title[language],
      content: firstLesson.contentUrl,
    });

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: this.i18nService.getTranslation('quizzes.start', language), callback_data: `start_quiz_lesson_${firstLesson.id}` }],
          [{ text: this.i18nService.getTranslation('courses.back', language), callback_data: 'list_courses' }],
        ],
      },
    };

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...keyboard });
    await bot.answerCallbackQuery(query.id);
  }
}