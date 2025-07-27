import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany, ManyToMany } from 'typeorm';
import { QuizResult } from '../quiz/quiz-result.entity';
import { Course } from '../course/course.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;
  
  @Column({ type: 'bigint', unique: true })
telegramId: string;


  @Column()
  fullName: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ default: 'uz' })
  language: string;

  @Column({ nullable: true })
  email: string;
  
  @Column({ nullable: true, default: 'awaiting_phone' })
  state?: 'awaiting_phone' | 'awaiting_email' | 'registered';

  @CreateDateColumn()
  registeredAt: Date;

  @OneToMany(() => QuizResult, (quizResult) => quizResult.user)
  quizResults: QuizResult[];
  
  @ManyToMany(() => Course, (course) => course.users)
  courses: Course[];
}