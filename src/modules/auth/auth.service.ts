import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from './auth.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  async isAdmin(telegramId: string): Promise<boolean> {
    try {
      const admin = await this.adminRepository.findOne({ where: { telegramId } });
      return !!admin;
    } catch (error) {
      this.logger.error(`Error checking admin status for telegramId: ${telegramId}, ${error.message}`);
      return false;
    }
  }

  async isAdminMode(telegramId: string): Promise<boolean> {
    try {
      const admin = await this.adminRepository.findOne({ where: { telegramId } });
      return admin?.isAdminMode || false;
    } catch (error) {
      this.logger.error(`Error checking admin mode for telegramId: ${telegramId}, ${error.message}`);
      return false;
    }
  }

  async setAdminMode(telegramId: string, isAdminMode: boolean): Promise<void> {
    try {
      let admin = await this.adminRepository.findOne({ where: { telegramId } });
      if (!admin) {
        this.logger.warn(`Admin not found for telegramId: ${telegramId}, cannot set admin mode`);
        return;
      }
      admin.isAdminMode = isAdminMode;
      await this.adminRepository.save(admin);
      this.logger.log(`Admin mode set to ${isAdminMode} for telegramId: ${telegramId}`);
    } catch (error) {
      this.logger.error(`Error setting admin mode for telegramId: ${telegramId}, ${error.message}`);
      throw error;
    }
  }

  async validateAdmin(telegramId: string, password: string): Promise<boolean> {
    try {
      const admin = await this.adminRepository.findOne({ where: { telegramId } });
      if (!admin) {
        return false;
      }
      return bcrypt.compare(password, admin.password);
    } catch (error) {
      this.logger.error(`Error validating admin for telegramId: ${telegramId}, ${error.message}`);
      return false;
    }
  }

  async createAdmin(telegramId: string, password: string): Promise<Admin> {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const admin = this.adminRepository.create({
        telegramId,
        password: hashedPassword,
        isAdminMode: false,
      });
      const savedAdmin = await this.adminRepository.save(admin);
      this.logger.log(`Admin created with telegramId: ${telegramId}`);
      return savedAdmin;
    } catch (error) {
      this.logger.error(`Error creating admin for telegramId: ${telegramId}, ${error.message}`);
      throw error;
    }
  }
}