import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AwsS3Module } from '@/infrastructure/awsS3/awsS3.module';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module';
import { UserController } from '@/user/user.controller';
import { UserService } from '@/user/user.service';

import { UserRepository } from './user.repository';

@Module({
  controllers: [UserController],
  providers: [UserService, UserRepository],
  imports: [PrismaModule, AwsS3Module, ConfigModule],
  exports: [UserService],
})
export class UserModule {}
