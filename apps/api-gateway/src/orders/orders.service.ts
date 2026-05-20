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
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
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

  findAll(): Promise<FindAllOrdersResponse> {
    return firstValueFrom(this.grpc.findAll({}));
  }

  findOne(id: string): Promise<Order> {
    return firstValueFrom(this.grpc.findOne({ id }));
  }

  createOrder(input: CreateOrderInput): Promise<Order> {
    return firstValueFrom(
      this.grpc.createOrder({
        productId: input.productId,
        quantity: input.quantity,
      }),
    );
  }

  updateOrderStatus(input: UpdateOrderStatusInput): Promise<Order> {
    return firstValueFrom(this.grpc.updateOrderStatus({ id: input.id, status: input.status }));
  }

  deleteOrder(id: string): Promise<DeleteOrderResponse> {
    return firstValueFrom(this.grpc.deleteOrder({ id }));
  }
}
