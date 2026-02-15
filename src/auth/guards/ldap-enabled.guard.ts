import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LdapEnabledGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const isEnabled = this.configService.get<string>('ENABLE_LDAP_OAUTH') === 'true';

    if (!isEnabled) {
      throw new ServiceUnavailableException('LDAP authentication is currently disabled.');
    }

    return true;
  }
}
