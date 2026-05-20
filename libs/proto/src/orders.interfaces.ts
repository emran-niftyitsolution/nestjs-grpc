// ---------------------------------------------------------------------------
// orders.interfaces.ts  —  TypeScript types that mirror orders.proto.
//
// Same pattern as products.interfaces.ts. Field names are camelCase here
// because @grpc/proto-loader converts snake_case proto fields to camelCase
// by default (keepCase: false).
//
//   proto field   product_id   →  TypeScript   productId
//   proto field   total_price  →  TypeScript   totalPrice
//   proto field   created_at   →  TypeScript   createdAt
// ---------------------------------------------------------------------------

export interface Order {
  id: string;
  productId: string; // camelCase conversion of product_id
  quantity: number;
  totalPrice: string; // camelCase of total_price; numeric stored as string
  status: string; // "pending" | "confirmed" | "shipped" | "delivered" | "cancelled"
  createdAt: string; // camelCase of created_at; ISO-8601 string
  updatedAt: string;
}

// --- FindAll ---
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FindAllOrdersRequest {} // empty — no filters yet
export interface FindAllOrdersResponse {
  orders: Order[];
}

// --- FindOne ---
export interface FindOneOrderRequest {
  id: string;
}

// --- CreateOrder ---
// Only product_id + quantity; orders-service derives total_price from product price.
export interface CreateOrderRequest {
  productId: string;
  quantity: number;
}

// --- UpdateOrderStatus ---
export interface UpdateOrderStatusRequest {
  id: string;
  status: string;
}

// --- DeleteOrder ---
export interface DeleteOrderRequest {
  id: string;
}
export interface DeleteOrderResponse {
  success: boolean;
}
