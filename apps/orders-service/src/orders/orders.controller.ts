// ---------------------------------------------------------------------------
// orders-service/orders/orders.controller.ts  —  gRPC entry point.
//
// Same controller-vs-service split as products-service:
//   Controller  — thin layer that maps gRPC method names to service calls.
//   Service     — all business logic (including the products-service gRPC call).
// ---------------------------------------------------------------------------

import type {
  CreateOrderRequest,
  DeleteOrderRequest,
  DeleteOrderResponse,
  FindAllOrdersRequest,
  FindAllOrdersResponse,
  FindOneOrderRequest,
  Order,
  UpdateOrderStatusRequest,
} from '@app/proto';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // 'OrdersService' must match `service OrdersService {` in orders.proto EXACTLY.
  @GrpcMethod('OrdersService', 'FindAll')
  findAll(_data: FindAllOrdersRequest): Promise<FindAllOrdersResponse> {
    return this.ordersService.findAll();
  }

  @GrpcMethod('OrdersService', 'FindOne')
  findOne(data: FindOneOrderRequest): Promise<Order> {
    return this.ordersService.findOne(data);
  }

  // THE KEY METHOD — triggers the service-to-service gRPC call inside OrdersService.
  @GrpcMethod('OrdersService', 'CreateOrder')
  createOrder(data: CreateOrderRequest): Promise<Order> {
    return this.ordersService.createOrder(data);
  }

  @GrpcMethod('OrdersService', 'UpdateOrderStatus')
  updateOrderStatus(data: UpdateOrderStatusRequest): Promise<Order> {
    return this.ordersService.updateOrderStatus(data);
  }

  @GrpcMethod('OrdersService', 'DeleteOrder')
  deleteOrder(data: DeleteOrderRequest): Promise<DeleteOrderResponse> {
    return this.ordersService.deleteOrder(data);
  }
}
