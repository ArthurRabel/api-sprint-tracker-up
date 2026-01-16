import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Type,
  mixin,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

export function IsEnabledAuthGuard(strategyName: string, configKey: string): Type<CanActivate> {
  @Injectable()
  class Guard implements CanActivate {
    constructor(private readonly configService: ConfigService) {}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
      const isEnabled = this.configService.get<string>(configKey) === 'true';

      if (!isEnabled) {
        throw new ServiceUnavailableException(
          `Authentication method '${strategyName}' is currently disabled.`,
        );
      }

      const passportAuthGuard = new (AuthGuard(strategyName))();
      return passportAuthGuard.canActivate(context);
    }
  }

  return mixin(Guard);
}
