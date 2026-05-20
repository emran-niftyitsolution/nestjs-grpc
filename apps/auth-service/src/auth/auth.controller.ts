// ---------------------------------------------------------------------------
// auth-service / auth.controller.ts  —  gRPC entry point for all auth RPCs.
//
// CONTROLLER vs SERVICE (why two files):
//   Controller  — knows about gRPC (decorators, parameter shapes). Its only
//                 job is to receive the incoming data and call the service.
//                 It contains NO business logic.
//   Service     — knows about bcrypt, JWT, Drizzle. Completely unaware of gRPC.
//                 Testable without a running gRPC server.
//
// @GrpcMethod('AuthService', 'Xxx') — the first arg must match `service AuthService`
//   in auth.proto EXACTLY. The second arg must match the `rpc Xxx` name exactly.
//   Mismatch = the handler is silently never called (no error at startup).
// ---------------------------------------------------------------------------

import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  TokenPayload,
  ValidateTokenRequest,
} from '@app/proto';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Register — creates a new user account and returns JWT + user profile.
  // Delegates to AuthService.register() which owns the bcrypt + DB logic.
  @GrpcMethod('AuthService', 'Register')
  register(data: RegisterRequest): Promise<AuthResponse> {
    return this.authService.register(data);
  }

  // Login — authenticates an existing user and returns JWT + user profile.
  @GrpcMethod('AuthService', 'Login')
  login(data: LoginRequest): Promise<AuthResponse> {
    return this.authService.login(data);
  }

  // ValidateToken — verifies a JWT signature and returns the decoded payload.
  // The gateway calls this via gRPC on every protected GraphQL operation.
  //
  // WHY synchronous (no async/await):
  //   AuthService.validateToken() does only CPU work (JwtService.verify is
  //   synchronous). No DB calls, no I/O. Wrapping it in async/await would add
  //   an unnecessary micro-task allocation.
  @GrpcMethod('AuthService', 'ValidateToken')
  validateToken(data: ValidateTokenRequest): TokenPayload {
    return this.authService.validateToken(data);
  }
}
