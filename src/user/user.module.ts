import { Module } from '@nestjs/common';

import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { UserController } from '@/user/user.controller';
import { UserService } from '@/user/user.service';

import { UserRepository } from './user.repository';

@Module({
  controllers: [UserController],
  providers: [UserService, UserRepository],
  imports: [PrismaModule],
  exports: [UserService],
})
export class UserModule {}
