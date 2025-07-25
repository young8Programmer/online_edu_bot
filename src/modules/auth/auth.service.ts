import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from './auth.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  async isAdmin(telegramId: string): Promise<boolean> {
    const admin = await this.adminRepository.findOne({ where: { telegramId } });
    return !!admin;
  }

  async validateAdmin(telegramId: string, password: string): Promise<boolean> {
    const admin = await this.adminRepository.findOne({ where: { telegramId } });
    if (!admin) return false;

    if (admin.loginAttempts >= 3 && admin.lastAttemptAt && new Date().getTime() - admin.lastAttemptAt.getTime() < 5 * 60 * 1000) {
      return false;
    }

    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      admin.loginAttempts += 1;
      admin.lastAttemptAt = new Date();
      await this.adminRepository.save(admin);
      return false;
    }

    admin.loginAttempts = 0;
    admin.isAdminMode = true;
    await this.adminRepository.save(admin);
    return true;
  }

  async createAdmin(telegramId: string, password: string): Promise<Admin> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = this.adminRepository.create({
      telegramId,
      password: hashedPassword,
      isAdminMode: true,
      loginAttempts: 0,
    });
    return this.adminRepository.save(admin);
  }

  async findByTelegramId(telegramId: string): Promise<Admin | null> {
    return this.adminRepository.findOne({ where: { telegramId } });
  }
}