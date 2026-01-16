import { Module } from '@nestjs/common';

import { UserController } from '@/user/user.controller';
import { UserService } from '@/user/user.service';
import { PrismaService } from '@/prisma/prisma.service';

@Module({
  controllers: [UserController],
  providers: [UserService, PrismaService],
  exports: [UserService],
})
export class UserModule {}
