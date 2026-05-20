// ---------------------------------------------------------------------------
// api-gateway/orders/orders.types.ts  —  GraphQL type definitions for Orders.
// Same code-first pattern as products.types.ts.
// ---------------------------------------------------------------------------

import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class OrderType {
  @Field()
  id: string;

  @Field()
  productId: string;

  @Field(() => Int)
  quantity: number;

  // totalPrice stored as string (numeric precision) — same reasoning as products.price.
  @Field()
  totalPrice: string;

  // "pending" | "confirmed" | "shipped" | "delivered" | "cancelled"
  @Field()
  status: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}

@ObjectType()
export class DeleteOrderResult {
  @Field()
  success: boolean;
}

@InputType()
export class CreateOrderInput {
  @Field()
  productId: string;

  // How many units to order. Must be positive; validated at the business logic layer.
  @Field(() => Int)
  quantity: number;
}

@InputType()
export class UpdateOrderStatusInput {
  @Field()
  id: string;

  // New status value. Allowed values enforced by orders-service business logic.
  @Field()
  status: string;
}
