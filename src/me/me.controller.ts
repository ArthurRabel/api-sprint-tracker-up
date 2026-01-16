import { Body, Controller, Get, UseGuards, Put, Delete } from '@nestjs/common';
import { ApiTags, ApiCookieAuth } from '@nestjs/swagger';

import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CurrentUser } from '@/auth/strategy/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/interfaces/user.interface';
import { ProfileService } from '@/me/me.service';

import { updateProfileDto } from './dto/update-profile.dto';
import {
  GetProfileDocs,
  UpdateProfileDocs,
  DeleteAccountDocs,
  GetNotificationsDocs,
} from './me.docs';

@ApiCookieAuth()
@ApiTags('User Profile')
@Controller({ path: 'me', version: '1' })
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @GetProfileDocs()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getUserProfile(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.profileService.getProfile(user.id);
    return profile;
  }

  @UpdateProfileDocs()
  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() data: updateProfileDto) {
    await this.profileService.updateProfile(user.id, data);
    return { message: 'Profile updated successfully.', data: data };
  }

  @DeleteAccountDocs()
  @UseGuards(JwtAuthGuard)
  @Delete()
  async deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    await this.profileService.deleteAccount(user.id);
    return { message: 'Account deleted successfully.' };
  }

  @GetNotificationsDocs()
  @UseGuards(JwtAuthGuard)
  @Get('notifications')
  async getNotifications(@CurrentUser() user: AuthenticatedUser) {
    const notifications = await this.profileService.getNotifications(user.id);
    return notifications;
  }
}
