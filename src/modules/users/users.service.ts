import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UsersRepository } from './users.repository';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import type { Actor } from '../../common/auth/security';
import { ApiError } from '../../common/http/api-error';
import { Page } from '../../common/http/response.interceptor';
@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}
  async create(dto: CreateUserDto, actor: Actor) {
    if (
      actor.role !== 'superadmin' &&
      ['admin', 'superadmin'].includes(dto.role)
    )
      throw new ApiError(
        403,
        'ROLE_FORBIDDEN',
        'Only superadmin can assign administrator roles',
      );
    const user = await this.repository.create({
      name: dto.name,
      email: dto.email,
      role: dto.role,
      passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
    });
    return this.present(user);
  }
  async list(page: number, limit: number) {
    const [users, total] = await Promise.all([
      this.repository.list(page, limit),
      this.repository.count(),
    ]);
    return new Page(
      users.map((user) => this.present(user)),
      { page, limit, total },
    );
  }
  async update(id: string, dto: UpdateUserDto, actor: Actor) {
    const user = await this.repository.findById(id);
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    if (
      actor.role !== 'superadmin' &&
      (['admin', 'superadmin'].includes(user.role) ||
        (dto.role && ['admin', 'superadmin'].includes(dto.role)))
    )
      throw new ApiError(
        403,
        'ROLE_FORBIDDEN',
        'Only superadmin can manage administrators',
      );
    if (
      id === actor.id &&
      (dto.active === false || (dto.role && dto.role !== actor.role))
    )
      throw new ApiError(
        409,
        'SELF_LOCKOUT',
        'Cannot deactivate or change your own role',
      );
    return this.present((await this.repository.update(id, dto))!);
  }
  present(user: {
    id?: string;
    _id: unknown;
    name: string;
    email: string;
    role: string;
    active: boolean;
  }) {
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
    };
  }
}
