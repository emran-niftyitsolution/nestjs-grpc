// ---------------------------------------------------------------------------
// orders-service/orders/orders.service.ts  —  business logic for Orders.
//
// THE BIG IDEA IN THIS FILE: orders-service acts as BOTH a gRPC server
// (it receives RPCs from api-gateway) AND a gRPC client (it calls
// products-service to validate products and retrieve prices).
//
// Service-to-service call flow for createOrder():
//
//   api-gateway                orders-service              products-service
//       │                           │                             │
//       │ CreateOrder(productId, q) │                             │
//       │──────────────────────────►│                             │
//       │                           │  FindOne({ id: productId }) │
//       │                           │────────────────────────────►│
//       │                           │◄────────────────────────────│
//       │                           │  { price: "29.99", ... }    │
//       │                           │                             │
//       │                           │  totalPrice = 29.99 × q     │
//       │                           │  INSERT INTO orders ...      │
//       │◄──────────────────────────│                             │
//       │  { id, totalPrice, ... }  │                             │
//
// This pattern ("choreography" or "synchronous composition") is how
// microservices build features that span multiple service boundaries without
// sharing a database.
// ---------------------------------------------------------------------------

import type {
  CreateOrderRequest,
  DeleteOrderRequest,
  DeleteOrderResponse,
  FindAllOrdersResponse,
  FindOneOrderRequest,
  FindOneRequest,
  Product,
  Order as ProtoOrder,
  UpdateOrderStatusRequest,
} from '@app/proto';
import { PRODUCTS_SERVICE } from '@app/proto';
import { status } from '@grpc/grpc-js';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { type ClientGrpc, RpcException } from '@nestjs/microservices';
import { eq } from 'drizzle-orm';
import { firstValueFrom, type Observable } from 'rxjs';

import { type Order as DbOrder, DRIZZLE_CLIENT, type DrizzleClient, orders } from '../db';

// ---------------------------------------------------------------------------
// ProductsGrpcService interface — the client-side view of products-service.
// Methods return Observable<T> (not Promise) — that's what the gRPC proxy gives us.
// Same interface as in api-gateway/products/products.service.ts, duplicated here
// by design: each service declares its own client contract, not a shared one.
// ---------------------------------------------------------------------------
interface ProductsGrpcService {
  findOne(data: FindOneRequest): Observable<Product>;
}

// ---------------------------------------------------------------------------
// toProtoOrder — converts a Drizzle DB row to the gRPC Order message shape.
// Same pattern as toProtoProduct in products.service.ts.
// ---------------------------------------------------------------------------
function toProtoOrder(row: DbOrder): ProtoOrder {
  return {
    id: row.id,
    productId: row.productId, // camelCase (DB column is product_id)
    quantity: row.quantity,
    totalPrice: row.totalPrice, // Drizzle returns numeric as string already
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class OrdersService implements OnModuleInit {
  // The gRPC client proxy for products-service. Set in onModuleInit().
  private productsGrpc: ProductsGrpcService | undefined;

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,

    // Inject the gRPC client for products-service.
    // PRODUCTS_SERVICE is the injection token registered in OrdersModule's
    // ClientsModule.register(). This is what makes orders-service a CLIENT
    // of products-service at the same time as being a SERVER for api-gateway.
    @Inject(PRODUCTS_SERVICE) private readonly productsClient: ClientGrpc,
  ) {}

  onModuleInit() {
    // 'ProductsService' must match `service ProductsService {` in products.proto.
    this.productsGrpc = this.productsClient.getService<ProductsGrpcService>('ProductsService');
  }

  private get products(): ProductsGrpcService {
    if (!this.productsGrpc) throw new Error('Products gRPC client not initialized');
    return this.productsGrpc;
  }

  // ---------------------------------------------------------------------------
  // findAll — SELECT * FROM orders
  // ---------------------------------------------------------------------------
  async findAll(): Promise<FindAllOrdersResponse> {
    const rows = await this.db.select().from(orders);
    return { orders: rows.map(toProtoOrder) };
  }

  // ---------------------------------------------------------------------------
  // findOne — SELECT * FROM orders WHERE id = $1
  // ---------------------------------------------------------------------------
  async findOne(data: FindOneOrderRequest): Promise<ProtoOrder> {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, data.id));
    if (!row) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Order with id '${data.id}' not found`,
      });
    }
    return toProtoOrder(row);
  }

  // ---------------------------------------------------------------------------
  // createOrder — THE SERVICE-TO-SERVICE CALL.
  //
  // Steps:
  //   1. Call products-service.FindOne to validate the product exists & get price.
  //   2. Compute totalPrice = product.price × quantity (using string-to-number).
  //   3. Insert the order into DB.
  //   4. Return the created order.
  //
  // ERROR PROPAGATION ACROSS SERVICE HOPS — an important microservices lesson:
  //   When products-service throws RpcException(NOT_FOUND), @grpc/grpc-js
  //   serialises the status code onto the wire. orders-service's client
  //   receives it as a ServiceError with a `.code` property.
  //   BUT — if orders-service lets that error bubble up as-is, NestJS re-wraps
  //   it as gRPC status UNKNOWN (2) before sending it to api-gateway, because
  //   a ServiceError is not a RpcException and NestJS doesn't recognise it.
  //
  //   The fix: catch the ServiceError, read its `.code`, and re-throw a fresh
  //   RpcException with the same (or translated) status code. This ensures the
  //   correct code travels the full path: products → orders → api-gateway.
  // ---------------------------------------------------------------------------
  async createOrder(data: CreateOrderRequest): Promise<ProtoOrder> {
    // Step 1: validate product exists and get its current price.
    let product: Product;
    try {
      product = await firstValueFrom(this.products.findOne({ id: data.productId }));
    } catch (err) {
      // Re-throw with the correct gRPC status code so the error is meaningful
      // to the caller (api-gateway → GraphQL → browser).
      const code = (err as { code?: number }).code ?? status.INTERNAL;
      const message =
        code === status.NOT_FOUND
          ? `Product with id '${data.productId}' not found`
          : 'Failed to reach products-service';
      throw new RpcException({ code, message });
    }

    // Step 2: compute total price.
    // product.price is a string ("29.99"). parseFloat converts it for arithmetic.
    // We round to 2 decimal places and re-stringify to keep numeric precision.
    const totalPrice = (parseFloat(product.price) * data.quantity).toFixed(2);

    // Step 3: insert the order.
    const [row] = await this.db
      .insert(orders)
      .values({
        productId: data.productId,
        quantity: data.quantity,
        totalPrice,
        // status defaults to 'pending' at the DB level (see schema.ts)
      })
      .returning();

    return toProtoOrder(row!);
  }

  // ---------------------------------------------------------------------------
  // updateOrderStatus — UPDATE orders SET status = $1 WHERE id = $2 RETURNING *
  // ---------------------------------------------------------------------------
  async updateOrderStatus(data: UpdateOrderStatusRequest): Promise<ProtoOrder> {
    const [row] = await this.db
      .update(orders)
      .set({ status: data.status })
      .where(eq(orders.id, data.id))
      .returning();

    if (!row) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Order with id '${data.id}' not found`,
      });
    }
    return toProtoOrder(row);
  }

  // ---------------------------------------------------------------------------
  // deleteOrder — DELETE FROM orders WHERE id = $1 RETURNING id
  // ---------------------------------------------------------------------------
  async deleteOrder(data: DeleteOrderRequest): Promise<DeleteOrderResponse> {
    const [deleted] = await this.db
      .delete(orders)
      .where(eq(orders.id, data.id))
      .returning({ id: orders.id });

    if (!deleted) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Order with id '${data.id}' not found`,
      });
    }
    return { success: true };
  }
}
