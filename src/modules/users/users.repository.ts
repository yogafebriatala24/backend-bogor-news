import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { User } from './user.schema';
import type { Role } from '../../common/auth/security';
@Injectable()
export class UsersRepository {
  constructor(@InjectModel('User') private readonly model: Model<User>) {}
  findByEmail(email: string) {
    return this.model.findOne({ email }).select('+passwordHash').exec();
  }
  findById(id: string) {
    return this.model.findById(id).exec();
  }
  create(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
  }) {
    return this.model.create(data);
  }
  list(page: number, limit: number) {
    return this.model
      .find()
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
  }
  count() {
    return this.model.countDocuments().exec();
  }
  update(id: string, data: Partial<Pick<User, 'name' | 'role' | 'active'>>) {
    return this.model
      .findByIdAndUpdate(
        id,
        { $set: data },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
  }
}
