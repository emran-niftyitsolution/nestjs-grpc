// ---------------------------------------------------------------------------
// api-gateway/orders/orders.service.ts  —  gRPC client wrapper for Orders.
//
// Same pattern as api-gateway/products/products.service.ts but pointing at
// orders-service instead of products-service.
// ---------------------------------------------------------------------------

import type {
  DeleteOrderResponse,
  FindAllOrdersResponse,
  FindOneOrderRequest,
  Order,
  UpdateOrderStatusRequest,
} from '@app/proto';
import { ORDERS_SERVICE } from '@app/proto';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, type Observable } from 'rxjs';

import type { CreateOrderInput, UpdateOrderStatusInput } from './orders.types';

// Client-side view of orders-service — methods return Observable<T>.
interface OrdersGrpcService {
  findAll(data: Record<string, never>): Observable<FindAllOrdersResponse>;
  findOne(data: FindOneOrderRequest): Observable<Order>;
  createOrder(data: { productId: string; quantity: number }): Observable<Order>;
  updateOrderStatus(data: UpdateOrderStatusRequest): Observable<Order>;
  deleteOrder(data: { id: string }): Observable<DeleteOrderResponse>;
}

@Injectable()
export class OrdersClientService implements OnModuleInit {
  // [GW] log prefix identifies gateway-side gRPC dispatch — matches README flow diagrams.
  private readonly logger = new Logger('GW');

  private ordersGrpc: OrdersGrpcService | undefined;

  constructor(@Inject(ORDERS_SERVICE) private readonly client: ClientGrpc) {}

  onModuleInit() {
    // 'OrdersService' must match `service OrdersService {` in orders.proto.
    this.ordersGrpc = this.client.getService<OrdersGrpcService>('OrdersService');
  }

  private get grpc(): OrdersGrpcService {
    if (!this.ordersGrpc) throw new Error('Orders gRPC client not initialized');
    return this.ordersGrpc;
  }

  async findAll(): Promise<FindAllOrdersResponse> {
    const t = Date.now();
    this.logger.log('→ orders-service.FindAll (gRPC)');
    const result = await firstValueFrom(this.grpc.findAll({}));
    this.logger.log(
      `← orders-service.FindAll  count=${result.orders?.length ?? 0}  +${Date.now() - t}ms`,
    );
    return result;
  }

  async findOne(id: string): Promise<Order> {
    const t = Date.now();
    this.logger.log(`→ orders-service.FindOne (gRPC)  id=${id}`);
    const result = await firstValueFrom(this.grpc.findOne({ id }));
    this.logger.log(`← orders-service.FindOne  id=${result.id}  +${Date.now() - t}ms`);
    return result;
  }

  async createOrder(input: CreateOrderInput): Promise<Order> {
    const t = Date.now();
    this.logger.log(
      `→ orders-service.CreateOrder (gRPC)  productId=${input.productId} qty=${input.quantity}`,
    );
    const result = await firstValueFrom(
      this.grpc.createOrder({
        productId: input.productId,
        quantity: input.quantity,
      }),
    );
    this.logger.log(`← orders-service.CreateOrder  id=${result.id}  +${Date.now() - t}ms`);
    return result;
  }

  async updateOrderStatus(input: UpdateOrderStatusInput): Promise<Order> {
    const t = Date.now();
    this.logger.log(
      `→ orders-service.UpdateOrderStatus (gRPC)  id=${input.id} status=${input.status}`,
    );
    const result = await firstValueFrom(
      this.grpc.updateOrderStatus({ id: input.id, status: input.status }),
    );
    this.logger.log(`← orders-service.UpdateOrderStatus  id=${result.id}  +${Date.now() - t}ms`);
    return result;
  }

  async deleteOrder(id: string): Promise<DeleteOrderResponse> {
    const t = Date.now();
    this.logger.log(`→ orders-service.DeleteOrder (gRPC)  id=${id}`);
    const result = await firstValueFrom(this.grpc.deleteOrder({ id }));
    this.logger.log(
      `← orders-service.DeleteOrder  success=${result.success}  +${Date.now() - t}ms`,
    );
    return result;
  }
}
