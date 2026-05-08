export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class BrawlStarsApiError extends AppError {
  constructor(message: string, statusCode?: number) {
    super(message, 'BRAWL_STARS_API_ERROR', statusCode);
    this.name = 'BrawlStarsApiError';
  }
}

export class VerificationError extends AppError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'VerificationError';
  }
}

export class RoleAssignmentError extends AppError {
  constructor(message: string) {
    super(message, 'ROLE_ASSIGNMENT_ERROR');
    this.name = 'RoleAssignmentError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}
