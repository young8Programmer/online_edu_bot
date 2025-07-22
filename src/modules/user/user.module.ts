import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './user.entity';
import { RegisterHandler } from './handlers/register.handler';
import { LanguageHandler } from './handlers/language.handler';
import { ProfileHandler } from './handlers/profile.handler';
import { I18nModule } from '../i18n/i18n.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    forwardRef(() => TelegramModule),
    I18nModule,
  ],
  controllers: [UserController],
  providers: [UserService, RegisterHandler, LanguageHandler, ProfileHandler],
  exports: [UserService],
})
export class UserModule {}