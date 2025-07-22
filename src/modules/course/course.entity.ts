import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Quiz } from '../quiz/quiz.entity';

@Entity()
export class Course {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('jsonb')
  title: { uz: string; ru: string; en: string };

  @Column('jsonb')
  description: { uz: string; ru: string; en: string };

  @Column({ default: false })
  isPaid: boolean;

  @Column({ type: 'decimal', nullable: true })
  price: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Quiz, (quiz) => quiz.course)
  quizzes: Quiz[];
}