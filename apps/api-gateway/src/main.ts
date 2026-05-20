// ---------------------------------------------------------------------------
// api-gateway / main.ts  —  the PROCESS ENTRYPOINT for the gateway app.
//
// In a NestJS monorepo every app under apps/* has its own main.ts. This is
// the file Bun executes (`bun --watch apps/api-gateway/src/main.ts`). Its only
// job: build the Nest application from the root module and start listening.
// ---------------------------------------------------------------------------

// WHY this import is FIRST and on its own line:
// NestJS uses TypeScript decorators (@Controller, @Injectable, ...). For Nest's
// dependency-injection to read decorator *metadata* at runtime, the
// `reflect-metadata` polyfill must be loaded before ANY decorated class is
// imported. Importing it at the very top of the entrypoint guarantees that.
import 'reflect-metadata';

// NestFactory is the factory that turns a "root module" into a running app.
import { NestFactory } from '@nestjs/core';

// The root module — the tree of controllers/providers Nest will wire together.
import { AppModule } from './app.module';
import { LoggingInterceptor } from './logging.interceptor';

// `bootstrap` is async because creating the app and binding a TCP port are
// both asynchronous operations.
async function bootstrap() {
  // NestFactory.create() instantiates every provider/controller in AppModule
  // (and its imported modules), resolving the dependency graph. By default it
  // uses the Express HTTP adapter (we installed @nestjs/platform-express).
  //
  // WHY the gateway is a normal HTTP server: it is the ONLY app exposed to the
  // outside world (browsers, mobile, curl). The products-service will NOT have
  // an HTTP port — it will speak gRPC only. Keeping that boundary clear is the
  // entire point of the gateway-vs-microservice architecture.
  const app = await NestFactory.create(AppModule);

  // Register the logging interceptor globally — covers every GraphQL resolver
  // and every HTTP controller method without touching individual files.
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Read the port from the environment so the same code runs on any machine /
  // in Docker without edits. `?? 5001` is the dev fallback when GATEWAY_PORT
  // is unset. (process.env is populated from .env by @nestjs/config, but the
  // OS environment also works — this line doesn't depend on Nest at all.)
  const port = process.env.GATEWAY_PORT ?? 5001;

  // Bind the TCP socket and start accepting requests. Until this resolves the
  // server is not reachable.
  await app.listen(port);

  // A plain console line so YOU can see, at a glance, that the right app came
  // up on the right port. Nest's own logger already prints route info above.
  console.log(`[api-gateway] HTTP listening on http://localhost:${port}`);
  console.log(`[api-gateway] GraphQL sandbox  on http://localhost:${port}/graphql`);
}

// Actually run it. (No top-level await here because tsconfig targets a module
// setup where keeping an explicit bootstrap() call is the conventional,
// most-portable Nest pattern.)
bootstrap();
