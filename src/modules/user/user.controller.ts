import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':telegramId')
  async findByTelegramId(@Param('telegramId') telegramId: string): Promise<User> {
    const user = await this.userService.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}