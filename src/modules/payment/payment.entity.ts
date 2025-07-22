import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../user/user.entity';
import { Course } from '../course/course.entity';

@Entity()
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.id)
  user: User;

  @ManyToOne(() => Course, (course) => course.id)
  course: Course;

  @Column()
  amount: number;

  @Column()
  status: 'pending' | 'completed' | 'failed';

  @Column()
  transactionId: string;

  @Column()
  paymentMethod: string;

  @CreateDateColumn()
  createdAt: Date;
}