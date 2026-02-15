import { FileValidator } from '@nestjs/common';

export class JsonFileValidator extends FileValidator {
  constructor() {
    super({});
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file) {
      return false;
    }

    try {
      JSON.parse(file.buffer.toString('utf-8'));
      return true;
    } catch {
      return false;
    }
  }

  buildErrorMessage(): string {
    return 'Invalid JSON file';
  }
}
