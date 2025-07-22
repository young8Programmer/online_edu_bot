import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  telegramId: string;

  @Column()
  fullName: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ default: 'uz' })
  language: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: 'awaiting_phone' })
  state: string;

  @CreateDateColumn()
  registeredAt: Date;
}