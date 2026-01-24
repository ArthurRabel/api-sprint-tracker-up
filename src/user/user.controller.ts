import { Body, Controller, Get, UseGuards, Put, Delete } from '@nestjs/common';
import { ApiTags, ApiCookieAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CurrentUser } from '@/auth/strategy/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/interfaces/user.interface';
import { UserService } from '@/user/user.service';

import { UpdateUserDto } from './dto/update-user.dto';
import { GetUserDocs, UpdateUserDocs, DeleteAccountDocs, GetNotificationsDocs } from './user.docs';

@ApiCookieAuth()
@ApiTags('User')
@Controller({ path: 'me', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @GetUserDocs()
  @UseGuards(JwtAuthGuard)
  @Get()
  async getUser(@CurrentUser() user: AuthenticatedUser) {
    const userData = await this.userService.getUser(user.id);
    return userData;
  }

  @UpdateUserDocs()
  @UseGuards(JwtAuthGuard)
  @Put()
  async updateUser(@CurrentUser() user: AuthenticatedUser, @Body() data: UpdateUserDto) {
    await this.userService.updateUser(user.id, data);
    return { message: 'User updated successfully.', data: data };
  }

  @DeleteAccountDocs()
  @UseGuards(JwtAuthGuard)
  @Delete()
  async deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    await this.userService.deleteAccount(user.id);
    return { message: 'Account deleted successfully.' };
  }

  @GetNotificationsDocs()
  @UseGuards(JwtAuthGuard)
  @Get('notifications')
  async getNotifications(@CurrentUser() user: AuthenticatedUser) {
    const notifications = await this.userService.getNotifications(user.id);
    return notifications;
  }
}
