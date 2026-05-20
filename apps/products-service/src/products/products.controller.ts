// ---------------------------------------------------------------------------
// products.controller.ts  —  the gRPC entry point for all Products RPCs.
//
// CONTROLLER vs SERVICE (why two files):
//   Controller  — knows about gRPC (decorators, transport details). Its only
//                 job is to receive the incoming RPC data and delegate to the
//                 service. It should contain NO business logic.
//   Service     — knows about business logic and the database. It is completely
//                 unaware of gRPC. This separation means you can test the
//                 service without a running gRPC server, and swap the transport
//                 layer without rewriting business logic.
// ---------------------------------------------------------------------------

import type {
  CreateProductRequest,
  DeleteProductRequest,
  DeleteProductResponse,
  FindAllRequest,
  FindAllResponse,
  FindOneRequest,
  ListStreamRequest,
  Product,
  UpdateProductRequest,
} from '@app/proto';
import { Controller } from '@nestjs/common';
// GrpcMethod is the decorator that maps a method to a specific gRPC RPC.
// It replaces @Get / @Post in a gRPC service — there are no HTTP paths here.
import { GrpcMethod } from '@nestjs/microservices';
import { type Observable } from 'rxjs';

import { ProductsService } from './products.service';

// @Controller() with no route prefix. In a gRPC microservice the route is
// determined by the proto ServiceName + RPC name, not by URL strings.
// Nest still requires @Controller() on the class — it marks the class as a
// route handler so Nest includes it in the app's handler registry.
@Controller()
export class ProductsController {
  // Standard NestJS constructor injection — Nest resolves ProductsService
  // from the DI container and passes it here automatically.
  constructor(private readonly productsService: ProductsService) {}

  // ---------------------------------------------------------------------------
  // @GrpcMethod(serviceName, methodName)
  //
  // serviceName  — must match `service ProductsService {` in products.proto EXACTLY.
  // methodName   — must match `rpc FindAll` in products.proto EXACTLY.
  //
  // When the gateway calls `ProductsService.FindAll(request)`, gRPC routes it
  // to this method. Nest deserialises the binary protobuf payload into a plain
  // JS object typed as FindAllRequest before calling the method.
  // ---------------------------------------------------------------------------

  @GrpcMethod('ProductsService', 'FindAll')
  findAll(_data: FindAllRequest): Promise<FindAllResponse> {
    // _data is prefixed with _ because FindAllRequest is currently empty —
    // no filter fields. The underscore silences the "unused param" lint rule.
    return this.productsService.findAll();
  }

  @GrpcMethod('ProductsService', 'FindOne')
  findOne(data: FindOneRequest): Promise<Product> {
    return this.productsService.findOne(data);
  }

  @GrpcMethod('ProductsService', 'CreateProduct')
  createProduct(data: CreateProductRequest): Promise<Product> {
    return this.productsService.create(data);
  }

  @GrpcMethod('ProductsService', 'UpdateProduct')
  updateProduct(data: UpdateProductRequest): Promise<Product> {
    return this.productsService.update(data);
  }

  @GrpcMethod('ProductsService', 'DeleteProduct')
  deleteProduct(data: DeleteProductRequest): Promise<DeleteProductResponse> {
    return this.productsService.delete(data);
  }

  // ---------------------------------------------------------------------------
  // ListStream — server-streaming RPC (Step 9).
  //
  // Returns Observable<Product> instead of Promise<Product>.
  // NestJS detects the Observable return type and automatically switches to
  // streaming mode: it calls grpcCall.write(item) for each emitted value and
  // grpcCall.end() when the Observable completes. No extra decorator needed —
  // @GrpcMethod works for both unary (Promise) and server-streaming (Observable).
  // ---------------------------------------------------------------------------
  @GrpcMethod('ProductsService', 'ListStream')
  listStream(data: ListStreamRequest): Observable<Product> {
    return this.productsService.listStream(data);
  }
}
