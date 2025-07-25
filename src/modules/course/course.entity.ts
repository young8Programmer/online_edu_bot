import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { Quiz } from '../quiz/quiz.entity';
import { Lesson } from '../lesson/lesson.entity';
import { User } from '../user/user.entity';

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

  @Column({ nullable: true })
  category: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Lesson, (lesson) => lesson.course, { cascade: true })
  lessons: Lesson[];

  @OneToMany(() => Quiz, (quiz) => quiz.course, { cascade: true })
  quizzes: Quiz[];

  @ManyToMany(() => User, (user) => user.courses)
  @JoinTable({ name: 'user_courses' })
  users: User[];
}