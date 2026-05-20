// ---------------------------------------------------------------------------
// api-gateway / auth.service.ts  —  gRPC client wrapper for auth-service.
//
// SAME PATTERN as ProductsClientService and OrdersClientService:
//   • Injects the named gRPC client (AUTH_SERVICE) created by ClientsModule.
//   • Calls OnModuleInit to get a typed handle on the remote gRPC service.
//   • Each method wraps one gRPC call in a Promise so resolvers stay clean.
//
// WHY wrap Observable in firstValueFrom():
//   gRPC unary calls (one request → one response) return an Observable that
//   emits exactly ONE value and then completes. `firstValueFrom()` converts
//   that single-emission Observable into a Promise — the cleanest async
//   primitive for GraphQL resolvers.
//
//   ValidateToken is the same pattern even though it does CPU-only work on
//   the auth-service side — from the gateway's perspective it's still an RPC.
// ---------------------------------------------------------------------------

import type { AuthResponse, LoginRequest, RegisterRequest, TokenPayload } from '@app/proto';
import { AUTH_SERVICE } from '@app/proto';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, type Observable } from 'rxjs';

// The TypeScript shape of the remote gRPC service.
// Each method signature mirrors the auth.proto RPCs.
//
// WHY Observable return types here (not Promise):
//   @grpc/grpc-js delivers results as Observables. We convert to Promises
//   in the wrapper methods below using firstValueFrom(). Declaring Observable
//   here keeps the interface honest about what the gRPC transport returns.
interface AuthGrpcService {
  register(data: RegisterRequest): Observable<AuthResponse>;
  login(data: LoginRequest): Observable<AuthResponse>;
  validateToken(data: { token: string }): Observable<TokenPayload>;
}

@Injectable()
export class AuthClientService implements OnModuleInit {
  // [GW] log prefix identifies gateway-side gRPC dispatch in the console output.
  // These logs correspond to the numbered flow steps in the README diagrams.
  private readonly logger = new Logger('GW');

  // `grpc` is the ClientGrpc proxy injected by ClientsModule.
  // It does NOT have typed methods yet — those come from `getService()` below.
  private grpc: AuthGrpcService;

  constructor(
    // @Inject(AUTH_SERVICE) matches `name: AUTH_SERVICE` in auth.module.ts.
    @Inject(AUTH_SERVICE) private readonly client: ClientGrpc,
  ) {}

  // Called automatically by NestJS after all providers are wired.
  // `getService<T>('AuthService')` — 'AuthService' MUST match `service AuthService`
  // in auth.proto exactly. Returns a typed proxy object with one method per RPC.
  onModuleInit() {
    this.grpc = this.client.getService<AuthGrpcService>('AuthService');
  }

  // ---------------------------------------------------------------------------
  // PUBLIC METHODS — one per gRPC RPC, Observable → Promise conversion.
  // ---------------------------------------------------------------------------

  async register(data: RegisterRequest): Promise<AuthResponse> {
    this.logger.log(`→ auth-service.Register (gRPC)  email=${data.email}`);
    const result = await firstValueFrom(this.grpc.register(data));
    this.logger.log(`← auth-service.Register  userId=${result.user?.id}`);
    return result;
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    this.logger.log(`→ auth-service.Login (gRPC)  email=${data.email}`);
    const result = await firstValueFrom(this.grpc.login(data));
    this.logger.log(`← auth-service.Login  userId=${result.user?.id}`);
    return result;
  }

  // Called by JwtAuthGuard on every protected GraphQL operation.
  // Returns TokenPayload { userId, email, name } or throws if token is invalid.
  async validateToken(token: string): Promise<TokenPayload> {
    this.logger.log('→ auth-service.ValidateToken (gRPC)');
    const result = await firstValueFrom(this.grpc.validateToken({ token }));
    this.logger.log(`← auth-service.ValidateToken  userId=${result.userId}`);
    return result;
  }
}
