// src/auth/decorators/get-user.decorator.ts - NEW FILE
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract the current user from the request
 * @example
 * async getProfile(@GetUser() user: any) {
 *   return user;
 * }
 * 
 * // Get specific field
 * async getProfile(@GetUser('email') email: string) {
 *   return email;
 * }
 */
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
