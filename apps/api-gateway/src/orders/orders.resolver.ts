// ---------------------------------------------------------------------------
// api-gateway/orders/orders.resolver.ts  —  GraphQL resolver for Orders.
// ---------------------------------------------------------------------------

import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { OrdersClientService } from './orders.service';
import {
  CreateOrderInput,
  DeleteOrderResult,
  OrderType,
  UpdateOrderStatusInput,
} from './orders.types';

@Resolver(() => OrderType)
export class OrdersResolver {
  constructor(private readonly ordersService: OrdersClientService) {}

  @Query(() => [OrderType], { name: 'orders' })
  async findAll(): Promise<OrderType[]> {
    const response = await this.ordersService.findAll();
    // Same ?? [] guard as products — empty proto repeated fields arrive as undefined.
    return (response.orders ?? []) as OrderType[];
  }

  @Query(() => OrderType, { name: 'order' })
  async findOne(@Args('id') id: string): Promise<OrderType> {
    return (await this.ordersService.findOne(id)) as OrderType;
  }

  // createOrder — the interesting mutation:
  //   GraphQL client sends { productId, quantity }
  //   api-gateway  →  orders-service (gRPC)
  //   orders-service  →  products-service (gRPC, service-to-service)
  //   orders-service inserts order with computed totalPrice
  //   result propagates back through the chain
  @Mutation(() => OrderType)
  async createOrder(@Args('input') input: CreateOrderInput): Promise<OrderType> {
    return (await this.ordersService.createOrder(input)) as OrderType;
  }

  @Mutation(() => OrderType)
  async updateOrderStatus(@Args('input') input: UpdateOrderStatusInput): Promise<OrderType> {
    return (await this.ordersService.updateOrderStatus(input)) as OrderType;
  }

  @Mutation(() => DeleteOrderResult)
  deleteOrder(@Args('id') id: string): Promise<DeleteOrderResult> {
    return this.ordersService.deleteOrder(id);
  }
}
