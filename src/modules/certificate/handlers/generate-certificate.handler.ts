import { Injectable } from '@nestjs/common';
import { CertificateService } from '../certificate.service';
import { UserService } from '../../user/user.service';
import { CourseService } from '../../course/course.service';
import { I18nService } from '../../i18n/i18n.service';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class GenerateCertificateHandler {
  constructor(
    private readonly certificateService: CertificateService,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly i18nService: I18nService,
  ) {}

  async handle(query: TelegramBot.CallbackQuery, bot: TelegramBot) {
    const chatId = query.message.chat.id;
    const courseId = parseInt(query.data.split('_')[2], 10);
    const telegramId = query.from.id.toString();

    const user = await this.userService.findByTelegramId(telegramId);
    const language =
      user?.language && ['uz', 'ru', 'en'].includes(user.language)
        ? user.language
        : 'uz';

    if (!user) {
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('errors.user_not_found', language),
      );
      return;
    }

    const course = await this.courseService.findById(courseId);
    if (!course) {
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('errors.course_not_found', language),
      );
      return;
    }

    try {
      const certificateBuffer = await this.certificateService.generateCertificate(
        telegramId,
        courseId,
        language,
      );

      await bot.sendDocument(
        chatId,
        {
          source: certificateBuffer,
          filename: `certificate_${courseId}.pdf`,
        },
        {
          caption: this.i18nService.getTranslation('certificates.certificate_caption', language, {
            title: course.title[language],
          }),
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
        },
      );
    } catch (error) {
      await bot.sendMessage(
        chatId,
        this.i18nService.getTranslation('errors.certificate_generation_failed', language, {
          reason: error.message,
        }),
      );
    }

    await bot.answerCallbackQuery(query.id);
  }
}
