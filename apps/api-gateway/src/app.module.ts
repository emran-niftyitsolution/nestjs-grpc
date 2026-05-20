// ---------------------------------------------------------------------------
// api-gateway / app.module.ts  —  root module of the HTTP/GraphQL gateway.
//
// Module dependency graph after Step 5:
//
//   AppModule
//   ├── ConfigModule  [global]  → provides ConfigService everywhere
//   ├── GraphQLModule           → sets up Apollo Server + code-first schema
//   └── ProductsModule
//       ├── ClientsModule       → provides the gRPC client (PRODUCTS_SERVICE)
//       ├── ProductsClientService ← wraps gRPC calls, Observable → Promise
//       └── ProductsResolver    ← @Query / @Mutation GraphQL handlers
//
// Public API surface after this step:
//   POST /graphql   — main GraphQL endpoint (queries + mutations)
//   GET  /graphql   — Apollo Sandbox / GraphiQL playground (dev mode only)
//   GET  /health    — plain HTTP health check (kept from Step 1)
// ---------------------------------------------------------------------------

// ApolloServerPluginLandingPageLocalDefault: Apollo Server v4 plugin that
//   serves the embedded Apollo Sandbox at GET /graphql in development.
//
//   WHY Sandbox instead of the legacy `playground: true`:
//     `playground: true` uses graphql-playground-html v1, which is unmaintained
//     and does not support Apollo Server v4 features (e.g. persisted queries,
//     operation collections, response hints). Apollo Sandbox is the current
//     maintained replacement with a richer UI.
//
//   `embed: true` — renders the Sandbox inline in the browser tab rather than
//     redirecting to studio.apollographql.com. This makes it work fully offline
//     and without an Apollo Studio account, just like the old playground did.
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';

// ApolloDriver: NestJS adapter that wraps Apollo Server v4.
//   Apollo Server handles the HTTP POST /graphql requests, parses GraphQL
//   documents, executes them against our resolvers, and serializes JSON.
//   NestJS sits on top and provides the DI wiring + decorator-based schema.
//
// ApolloDriverConfig: TypeScript interface for the driver options object
//   passed to GraphQLModule.forRoot(). Typed so the compiler catches typos
//   in config keys.
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// GraphQLModule: the NestJS module that bootstraps the entire GraphQL layer.
//   forRoot() accepts the driver + configuration and must be registered once
//   at the root module level (like ConfigModule).
import { GraphQLModule } from '@nestjs/graphql';

import { join } from 'path';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(__dirname, '../schema.gql'),
      sortSchema: true,
      // Disable the legacy graphql-playground-html v1 UI.
      playground: false,
      // Serve the embedded Apollo Sandbox at GET /graphql instead.
      plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],

      // Pass the Express request object into the GraphQL context so resolvers
      // and guards can access `ctx.req.headers.authorization` and `ctx.req.user`.
      //
      // WHY this is required for JwtAuthGuard:
      //   Apollo Server v4 no longer automatically includes the Express request
      //   in the execution context. Without this callback, `GqlExecutionContext
      //   .create(context).getContext().req` returns undefined and the guard
      //   cannot read the Authorization header.
      //
      // `({ req })` — destructures the Express request from the Apollo context
      //   argument. The returned object becomes the GraphQL context available
      //   via @Context() in resolvers and GqlExecutionContext in guards.
      context: ({ req }: { req: object }) => ({ req }),
    }),

    // Products domain — GraphQL ↔ gRPC client for products-service.
    ProductsModule,

    // Orders domain — GraphQL ↔ gRPC client for orders-service.
    // OrdersModule talks to orders-service, which in turn calls products-service.
    OrdersModule,

    // Auth domain — GraphQL register/login mutations + JWT guard + me query.
    // auth-service owns the JWT secret; the gateway validates tokens via gRPC.
    AuthModule,
  ],

  // AppController still handles GET /health — kept for container health checks.
  controllers: [AppController],
})
export class AppModule {}
