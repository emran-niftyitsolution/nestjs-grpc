// ---------------------------------------------------------------------------
// api-gateway / products.resolver.ts  —  GraphQL resolver for Products.
//
// WHAT IS A RESOLVER?
//   In GraphQL, a "resolver" is the function that provides the data for a
//   field in the schema. In NestJS, a class annotated @Resolver() groups
//   related resolver methods together, exactly like an HTTP controller groups
//   related route handlers.
//
//   Comparison:
//     REST controller:   @Get('/products')   → returns HTTP response
//     GraphQL resolver:  @Query(() => [...]) → returns data for a query
//
// THE GRAPHQL OPERATION TYPES:
//   @Query    — reads data (safe, idempotent — like GET)
//   @Mutation — writes data (changes state — like POST/PUT/DELETE)
//
// CODE-FIRST SCHEMA GENERATION:
//   Every @Query and @Mutation decorator receives a "return type thunk":
//     @Query(() => [ProductType])   — this query returns an array of ProductType
//     @Mutation(() => ProductType)  — this mutation returns a single ProductType
//   NestJS reads these thunks at startup to generate the .graphql SDL file.
// ---------------------------------------------------------------------------

// Args:      decorator to extract the full `args` object from a GraphQL operation.
// Mutation:  marks a method as a GraphQL mutation.
// Query:     marks a method as a GraphQL query.
// Resolver:  marks this class as a resolver for a specific type.
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { lastValueFrom } from 'rxjs';
import { toArray } from 'rxjs/operators';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProductsClientService } from './products.service';
import {
  CreateProductInput,
  DeleteResult,
  ProductType,
  UpdateProductInput,
} from './products.types';

// @Resolver(() => ProductType)  — tells NestJS GraphQL that this class
// resolves fields for the ProductType object type. For simple CRUD resolvers
// you don't strictly need the type hint, but it is required if you add
// @ResolveField() methods (field-level resolvers) later.
@Resolver(() => ProductType)
export class ProductsResolver {
  // ProductsClientService is injected by NestJS DI.
  // It handles the gRPC calls so the resolver stays thin —
  // it just maps GraphQL operations to service methods.
  constructor(private readonly productsService: ProductsClientService) {}

  // ---------------------------------------------------------------------------
  // QUERIES (read operations)
  // ---------------------------------------------------------------------------

  // @Query(() => [ProductType]) — returns a list of ProductType.
  // The `name: 'products'` option sets the field name in the GraphQL schema.
  // Without it NestJS would use the method name 'findAll', which is fine too.
  // In the schema this generates:
  //   type Query {
  //     products: [ProductType!]!
  //   }
  @Query(() => [ProductType], { name: 'products' })
  async findAll(): Promise<ProductType[]> {
    // The gRPC FindAll response wraps the list in { products: [...] }.
    // We destructure here so the resolver returns the array directly.
    //
    // WHY ?? [] (nullish coalesce):
    //   protobuf3 omits empty repeated fields from the serialized bytes.
    //   @grpc/proto-loader deserializes a missing repeated field as undefined,
    //   not []. GraphQL's [ProductType!]! (non-nullable list) rejects undefined
    //   as null and throws. The ?? [] guard normalizes that to an empty array.
    const response = await this.productsService.findAll();
    return (response.products ?? []) as ProductType[];
  }

  // @Query(() => ProductType) — returns a single product by id.
  //
  // @Args('id') — extracts the `id` argument from the GraphQL query.
  // In the schema:
  //   type Query {
  //     product(id: String!): ProductType!
  //   }
  @Query(() => ProductType, { name: 'product' })
  async findOne(@Args('id') id: string): Promise<ProductType> {
    return (await this.productsService.findOne(id)) as ProductType;
  }

  // ---------------------------------------------------------------------------
  // MUTATIONS (write operations)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // PROTECTED MUTATIONS — require a valid JWT in Authorization: Bearer <token>
  //
  // @UseGuards(JwtAuthGuard) runs BEFORE the resolver body:
  //   1. Extracts the Bearer token from the Authorization header.
  //   2. Calls auth-service.ValidateToken via gRPC.
  //   3. On success → attaches decoded payload to req.user, resolver runs.
  //   4. On failure → throws 401 Unauthorized, resolver never runs.
  //
  // WHY protect writes but not reads:
  //   Anyone can browse products (public catalogue). Only authenticated users
  //   (e.g. admins) should be able to add, edit, or remove them.
  // ---------------------------------------------------------------------------

  // createProduct — only authenticated users can add products.
  //   mutation {
  //     createProduct(input: { name: "...", price: "9.99" }) { id name price }
  //   }
  @UseGuards(JwtAuthGuard)
  @Mutation(() => ProductType)
  async createProduct(@Args('input') input: CreateProductInput): Promise<ProductType> {
    return (await this.productsService.createProduct(input)) as ProductType;
  }

  // updateProduct — only authenticated users can edit products.
  //   mutation {
  //     updateProduct(input: { id: "...", price: "19.99" }) { id name price }
  //   }
  @UseGuards(JwtAuthGuard)
  @Mutation(() => ProductType)
  async updateProduct(@Args('input') input: UpdateProductInput): Promise<ProductType> {
    return (await this.productsService.updateProduct(input)) as ProductType;
  }

  // deleteProduct — only authenticated users can delete products.
  //   mutation {
  //     deleteProduct(id: "...") { success }
  //   }
  @UseGuards(JwtAuthGuard)
  @Mutation(() => DeleteResult)
  deleteProduct(@Args('id') id: string): Promise<DeleteResult> {
    return this.productsService.deleteProduct(id);
  }

  // ---------------------------------------------------------------------------
  // productsStream — consumes the server-streaming gRPC RPC (Step 9).
  //
  // From GraphQL's perspective this is just a normal query that returns [ProductType].
  // The streaming happens BETWEEN orders-service and products-service over gRPC —
  // GraphQL itself has no concept of streaming here (that would require @Subscription).
  //
  // HOW toArray() + lastValueFrom() WORK TOGETHER:
  //   listStream() returns Observable<Product> that emits N individual products.
  //   toArray()      buffers every emission into an array, then emits that ONE
  //                  array when the source Observable completes.
  //   lastValueFrom  waits for the Observable-of-one-array to complete and
  //                  resolves the Promise with that final (and only) value.
  //
  // WHY lastValueFrom instead of firstValueFrom:
  //   After toArray() the Observable emits exactly once — the full array.
  //   Both would work, but lastValueFrom communicates intent: "wait for it all."
  // ---------------------------------------------------------------------------
  @Query(() => [ProductType], { name: 'productsStream' })
  productsStream(): Promise<ProductType[]> {
    return lastValueFrom(
      this.productsService.listStream().pipe(toArray()),
    ) as Promise<ProductType[]>;
  }
}
