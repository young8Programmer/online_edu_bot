import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Admin {
  @PrimaryGeneratedColumn()
  id: number;
@Column({ type: 'bigint', unique: true })
telegramId: string;

  @Column()
  password: string;

  @Column({ default: false })
  isAdminMode: boolean;

  @Column({ default: 0 })
  loginAttempts: number;

  @Column({ nullable: true })
  lastAttemptAt: Date;
}