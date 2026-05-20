// ---------------------------------------------------------------------------
// api-gateway / products.service.ts  —  gRPC client wrapper.
//
// THIS FILE IS THE BRIDGE BETWEEN GRAPHQL AND gRPC.
//
// The flow for a GraphQL query like `query { products { id name price } }`:
//
//   1. Apollo Server receives the HTTP POST to /graphql
//   2. NestJS GraphQL routes it to ProductsResolver.findAll()
//   3. Resolver calls ProductsService.findAll()    ← this file
//   4. This service calls products-service via gRPC over TCP:50052
//   5. products-service returns protobuf bytes
//   6. @grpc/grpc-js deserializes them into a plain JS object
//   7. The result bubbles back up through the resolver to Apollo
//   8. Apollo serializes it as JSON and sends the HTTP response
//
// KEY CONCEPTS IN THIS FILE:
//   • ClientGrpc  — the raw gRPC client injected by @nestjs/microservices
//   • getService() — creates a typed proxy for a specific gRPC service
//   • Observable  — gRPC methods return RxJS Observables (not Promises)
//   • firstValueFrom — converts Observable<T> to Promise<T> (takes 1 value)
//   • OnModuleInit — lifecycle hook, runs AFTER DI is resolved
// ---------------------------------------------------------------------------

// Shared types and the injection token from libs/proto.
import {
  type CreateProductRequest,
  type DeleteProductRequest,
  type DeleteProductResponse,
  type FindAllResponse,
  type FindOneRequest,
  type ListStreamRequest,
  PRODUCTS_SERVICE,
  type Product,
  type UpdateProductRequest,
} from '@app/proto';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
// ClientGrpc: the gRPC client object provided by @nestjs/microservices after
//   ClientsModule wires it up. Think of it as a "connection factory" —
//   you call getService() on it to get a typed proxy for a specific service.
import { type ClientGrpc } from '@nestjs/microservices';
// firstValueFrom: converts RxJS Observable<T> → Promise<T>.
// WHY: gRPC unary calls (one request, one response) return Observable
//   in NestJS. But async/await works with Promises, not Observables.
//   firstValueFrom() subscribes, waits for the first (and only) emitted
//   value, and resolves the Promise with it.
import { firstValueFrom, type Observable } from 'rxjs';

import { type CreateProductInput, type UpdateProductInput } from './products.types';

// ---------------------------------------------------------------------------
// The gRPC service interface — what methods the products-service exposes.
//
// WHY we define this interface here (not in libs/proto):
//   This interface describes the gRPC service from the CLIENT side.
//   Method signatures return Observable<T> because that's what the gRPC
//   client proxy produces. The server side (products.controller.ts) uses
//   Promise<T> instead — same contract, different async wrapper.
//
//   Defining it here (in the gateway) keeps the client-specific types
//   co-located with the code that uses them.
// ---------------------------------------------------------------------------
interface ProductsGrpcService {
  findAll(data: Record<string, never>): Observable<FindAllResponse>;
  findOne(data: FindOneRequest): Observable<Product>;
  createProduct(data: CreateProductRequest): Observable<Product>;
  updateProduct(data: UpdateProductRequest): Observable<Product>;
  deleteProduct(data: DeleteProductRequest): Observable<DeleteProductResponse>;
  // Server-streaming: emits one Product per frame instead of one FindAllResponse.
  // Return type stays Observable<Product> here — the caller decides whether to
  // collect all items (toArray) or process them one by one.
  listStream(data: ListStreamRequest): Observable<Product>;
}

// @Injectable() — registers this class in NestJS DI container so it can be
// injected into the resolver. Any class annotated @Injectable() can be listed
// in a module's `providers:` array.
@Injectable()
export class ProductsClientService implements OnModuleInit {
  // [GW] log prefix identifies gateway-side gRPC dispatch — matches README flow diagrams.
  private readonly logger = new Logger('GW');

  // The typed gRPC service proxy. Undefined until onModuleInit() runs.
  // WHY typed as `ProductsGrpcService | undefined`:
  //   TypeScript strict-null-checks would flag a bare `ProductsGrpcService`
  //   property as "definitely assigned" if we try to use it before init.
  //   Acknowledging the undefined state is honest — and onModuleInit()
  //   guarantees it is set before any method is called at runtime.
  private productsGrpc: ProductsGrpcService | undefined;

  constructor(
    // @Inject(PRODUCTS_SERVICE) — injects the ClientGrpc object registered in
    // ClientsModule.register([{ name: PRODUCTS_SERVICE, ... }]).
    // PRODUCTS_SERVICE is just a string token ('PRODUCTS_SERVICE'); it is NOT
    // a class, so we must use @Inject() instead of a constructor type hint.
    @Inject(PRODUCTS_SERVICE) private readonly client: ClientGrpc,
  ) {}

  // OnModuleInit lifecycle hook — NestJS calls this once after all providers
  // in the module are instantiated and DI is resolved.
  //
  // WHY not call getService() in the constructor:
  //   At constructor time the DI container may not have fully initialized the
  //   gRPC client's internal channel. onModuleInit() is guaranteed to run
  //   AFTER that. Calling getService() in the constructor is a common mistake
  //   that causes "Cannot read properties of undefined" errors.
  onModuleInit() {
    // getService<T>('ServiceName') — returns a proxy object that maps every
    // method in T to a gRPC call. The string 'ProductsService' must match the
    // `service ProductsService { ... }` declaration in products.proto.
    this.productsGrpc = this.client.getService<ProductsGrpcService>('ProductsService');
  }

  // ---------------------------------------------------------------------------
  // Helper: ensures productsGrpc is initialized before use.
  // Throws if called before onModuleInit() (should never happen at runtime,
  // but guards against test environments or unusual module ordering).
  // ---------------------------------------------------------------------------
  private get grpc(): ProductsGrpcService {
    if (!this.productsGrpc) {
      throw new Error('gRPC client not initialized — onModuleInit not called');
    }
    return this.productsGrpc;
  }

  // ---------------------------------------------------------------------------
  // CRUD wrappers — each converts the gRPC Observable to a Promise.
  // ---------------------------------------------------------------------------

  // findAll — no arguments in the proto request, so we pass an empty object.
  // firstValueFrom(observable) subscribes once, takes the first emitted value,
  // unsubscribes, and resolves the returned Promise.
  async findAll(): Promise<FindAllResponse> {
    const t = Date.now();
    this.logger.log('→ products-service.FindAll (gRPC)');
    const result = await firstValueFrom(this.grpc.findAll({}));
    this.logger.log(
      `← products-service.FindAll  count=${result.products?.length ?? 0}  +${Date.now() - t}ms`,
    );
    return result;
  }

  async findOne(id: string): Promise<Product> {
    const t = Date.now();
    this.logger.log(`→ products-service.FindOne (gRPC)  id=${id}`);
    const result = await firstValueFrom(this.grpc.findOne({ id }));
    this.logger.log(`← products-service.FindOne  id=${result.id}  +${Date.now() - t}ms`);
    return result;
  }

  async createProduct(input: CreateProductInput): Promise<Product> {
    const t = Date.now();
    this.logger.log(`→ products-service.CreateProduct (gRPC)  name=${input.name}`);
    const result = await firstValueFrom(
      this.grpc.createProduct({
        name: input.name,
        description: input.description ?? '',
        price: input.price,
        stock: input.stock,
      }),
    );
    this.logger.log(`← products-service.CreateProduct  id=${result.id}  +${Date.now() - t}ms`);
    return result;
  }

  async updateProduct(input: UpdateProductInput): Promise<Product> {
    const t = Date.now();
    this.logger.log(`→ products-service.UpdateProduct (gRPC)  id=${input.id}`);
    // Nullable fields fall back to empty string / 0 — the service preserves
    // existing values for fields that arrive as proto3 zero-values.
    const result = await firstValueFrom(
      this.grpc.updateProduct({
        id: input.id,
        name: input.name ?? '',
        description: input.description ?? '',
        price: input.price ?? '',
        stock: input.stock ?? 0,
      }),
    );
    this.logger.log(`← products-service.UpdateProduct  id=${result.id}  +${Date.now() - t}ms`);
    return result;
  }

  async deleteProduct(id: string): Promise<DeleteProductResponse> {
    const t = Date.now();
    this.logger.log(`→ products-service.DeleteProduct (gRPC)  id=${id}`);
    const result = await firstValueFrom(this.grpc.deleteProduct({ id }));
    this.logger.log(
      `← products-service.DeleteProduct  success=${result.success}  +${Date.now() - t}ms`,
    );
    return result;
  }

  // ---------------------------------------------------------------------------
  // listStream — returns the raw Observable, NOT wrapped in firstValueFrom.
  //
  // WHY keep it as Observable here (unlike all other methods):
  //   firstValueFrom() takes only the FIRST emitted value and cancels the
  //   subscription. For a streaming RPC that emits N products, that would
  //   give us only the first product and discard the rest.
  //
  //   Returning the Observable lets the resolver decide what to do with the
  //   stream — collect everything with toArray(), take the first N with take(),
  //   or pipe it into a GraphQL subscription in the future.
  // ---------------------------------------------------------------------------
  listStream(): Observable<Product> {
    this.logger.log('→ products-service.ListStream (gRPC server-streaming)');
    return this.grpc.listStream({});
  }
}
