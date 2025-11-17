# Financial Transactions: Donation & Shop Purchase Flows

**Date:** November 8, 2025  
**Project:** YPF Backend  
**Status:** Implemented

---

## Overview

This document comprehensively explains how financial transactions work in the YPF Backend, covering both donation and shop purchase flows. Understanding these flows is critical for implementing payment integrations, handling webhooks, and maintaining data consistency.

---

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [Donation Flow](#donation-flow)
3. [Shop Purchase Flow](#shop-purchase-flow)
4. [Transaction Verification](#transaction-verification)
5. [Webhook Handling](#webhook-handling)
6. [Email Notifications](#email-notifications)
7. [Database Schema](#database-schema)
8. [Error Handling](#error-handling)

---

## Core Architecture

### Class Table Inheritance Pattern

The system uses a **class table inheritance** pattern for financial transactions:

```
FinancialTransactions (Parent Table)
├── Donations (via `transactionId` foreign key)
├── DuesPayments (via `transactionId` foreign key)
└── OrderPayments (via `transactionId` foreign key → Orders)
```

**Benefits:**

- Single source of truth for all financial data
- Consistent transaction tracking
- Easy to add new transaction types
- Unified reporting and reconciliation

### Key Tables

1. **`finance.financial_transactions`** - Parent table for all transactions
2. **`finance.donations`** - Donation-specific data
3. **`finance.dues_payments`** - Membership dues payments
4. **`shop.order_payments`** - Links orders to transactions
5. **`shop.orders`** - Shop order details
6. **`shop.order_items`** - Individual items in an order

---

## Donation Flow

### Architecture Overview

```
User Initiates Donation
↓
createDonation (save-then-call pattern)
↓
Create FinancialTransaction (PENDING)
Create Donation record
↓
Initialize Paystack Payment
↓
Return Payment URL to Frontend
↓
User Completes Payment on Paystack
↓
Paystack Webhook → Update Transaction (COMPLETED)
↓
Send Acknowledgement Email
```

### Detailed Flow

#### Step 1: Donation Initiation

**Endpoint:** `POST /api/v1/donations`

**Input:**

```typescript
{
  amount: number;           // e.g., 50.00
  currency: string;         // e.g., "GHS", "USD"
  anonymous?: boolean;      // Default: false
  donorInfo?: {
    name: string;           // For guest donations
    email?: string;         // For guest donations
    phone?: string;         // Optional
  };
  projectId?: string;       // Optional - donate to specific project
  eventId?: string;         // Optional - donate to specific event
}
```

**Handler:** `shared/services/donationsService.ts → startPaystackDonation()`

#### Step 2: Save-Then-Call Pattern

The system uses a **save-then-call** pattern for scalability:

1. **First**: Save transaction and donation to database
2. **Then**: Call external payment provider
3. **Why**: If payment provider is slow/unavailable, we don't block the user

```typescript
// 1. Determine donor information
const constituentId = !anonymous ? (user?.constituentId ?? null) : null;
const guestName = !anonymous ? (donorInfo?.name ?? null) : null;
const guestEmail = !anonymous ? (donorInfo?.email ?? null) : null;

// 2. Generate unique payment reference
const paymentReference = uuidv4();

// 3. Create transaction (PENDING status)
const [newTransaction] = await tx
  .insert(schema.FinancialTransactions)
  .values({
    amount: amount.toFixed(2),
    currency,
    status: "PENDING",
    externalProvider: "PAYSTACK",
    externalRef: paymentReference,
  })
  .returning();

// 4. Create donation record
const [newDonation] = await tx
  .insert(schema.Donations)
  .values({
    transactionId: newTransaction.id,
    constituentId,
    guestName,
    guestEmail,
    projectId: projectId ?? null,
    eventId: eventId ?? null,
    acknowledgementSent: false,
  })
  .returning();

// 5. Initialize Paystack payment
const response = await fetch("https://api.paystack.co/transaction/initialize", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${variables.services.paystack.secretKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: guestEmail || user?.email || "donor@ypf.org",
    amount: Math.round(amount * 100), // Convert to kobo/cents
    reference: paymentReference,
    currency,
    callback_url: `${variables.app.clientUrl}/donations/verify`,
  }),
});
```

#### Step 3: Return Payment URL

```typescript
return {
  donation: {
    id: newDonation.id,
    amount: newTransaction.amount,
    currency: newTransaction.currency,
    status: newTransaction.status,
  },
  paymentUrl: paystackResponse.data.authorization_url,
};
```

**Frontend Action:** Redirect user to `paymentUrl` to complete payment

#### Step 4: Donation Types

The system supports three donation types:

1. **Anonymous Donation**

   ```typescript
   {
     constituentId: null,
     guestName: null,
     guestEmail: null,
   }
   ```

   - No donor information stored
   - No acknowledgement email sent
   - Completely anonymous

2. **Authenticated User Donation**

   ```typescript
   {
     constituentId: user.constituentId,
     guestName: null,
     guestEmail: null,
   }
   ```

   - Linked to user's constituent record
   - Email sent to user's registered email
   - Full donation history tracking

3. **Guest Donation**

   ```typescript
   {
     constituentId: null,
     guestName: "John Doe",
     guestEmail: "john@example.com",
   }
   ```

   - Stores guest information for future reconciliation
   - Sends acknowledgement to guest email
   - Can be linked to constituent later

#### Step 5: Verification

Users can verify their donation status:

**Endpoint:** `POST /api/v1/donations/:reference/verify`

This triggers:

1. API call to Paystack to verify transaction
2. Update transaction status if changed
3. Send acknowledgement email if completed

---

## Shop Purchase Flow

### Architecture Overview

```
User Adds Items to Cart
↓
createOrder (authenticated user)
↓
Validate Order Items (stock, pricing)
Calculate Total Amount
↓
Create Transaction (PENDING)
Create Order
Create OrderPayment (links Order → Transaction)
Create OrderItems
Decrement Product Stock
↓
Initialize Paystack Payment
↓
Return Payment URL to Frontend
↓
User Completes Payment on Paystack
↓
Paystack Webhook → Update Transaction (COMPLETED)
↓
Update Order Status (PAID)
Send Order Confirmation Email
```

### Detailed Flow

#### Step 1: Order Creation

**Endpoint:** `POST /api/v1/shop/orders`

**Input:**

```typescript
{
  items: [
    {
      productId: string;
      quantity: number;
    }
  ];
  currency: string;
  deliveryAddress?: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
}
```

**Handler:** `shared/services/shopService.ts → createAuthenticatedOrder()`

#### Step 2: Item Validation

**Critical Step:** Validate all items before creating any records

```typescript
export async function validateOrderItems(items: OrderItem[]) {
  // 1. Fetch all products in a SINGLE query
  const productIds = items.map((item) => item.productId);
  const dbProducts = await dbClient.db
    .select()
    .from(schema.Products)
    .where(inArray(schema.Products.id, productIds));

  // 2. Create Map for O(1) lookups
  const productMap = new Map(
    dbProducts.map((product) => [product.id, product]),
  );

  let totalAmount = 0;
  const validatedItems = [];

  // 3. Validate each item
  for (const item of items) {
    const product = productMap.get(item.productId);

    // Check product exists
    if (!product) {
      throw new ApiError(`Product with ID ${item.productId} not found`, 404);
    }

    // Check product is active
    if (!product.isActive) {
      throw new ApiError(
        `Product "${product.name}" is no longer available`,
        400,
      );
    }

    // Check stock availability
    if (product.stockQuantity < item.quantity) {
      throw new ApiError(
        `Insufficient stock for "${product.name}". Only ${product.stockQuantity} available.`,
        400,
      );
    }

    // Calculate total
    const itemPrice = parseFloat(product.price);
    totalAmount += itemPrice * item.quantity;

    validatedItems.push({
      productId: product.id,
      quantity: item.quantity,
      price: product.price,
      name: product.name,
    });
  }

  return { validatedItems, totalAmount };
}
```

#### Step 3: Database Transaction

**Critical:** All database operations in a single transaction to ensure consistency

```typescript
const result = await dbClient.db.transaction(async (tx) => {
  // 1. Create financial transaction
  const [newTransaction] = await tx
    .insert(schema.FinancialTransactions)
    .values({
      amount: totalAmount.toFixed(2),
      currency,
      status: "PENDING",
      externalProvider: "PAYSTACK",
      externalRef: paymentReference,
    })
    .returning();

  // 2. Create order
  const [newOrder] = await tx
    .insert(schema.Orders)
    .values({
      constituentId: user.constituentId,
      totalAmount: totalAmount.toFixed(2),
      status: "PENDING",
      deliveryAddress: deliveryAddress ? JSON.stringify(deliveryAddress) : null,
    })
    .returning();

  // 3. Link order to transaction
  await tx.insert(schema.OrderPayments).values({
    orderId: newOrder.id,
    transactionId: newTransaction.id,
  });

  // 4. Create order items
  const orderItemsData = validatedItems.map((item) => ({
    orderId: newOrder.id,
    productId: item.productId,
    quantity: item.quantity,
    price: item.price,
  }));

  await tx.insert(schema.OrderItems).values(orderItemsData);

  // 5. Decrement product stock
  for (const item of validatedItems) {
    await tx
      .update(schema.Products)
      .set({
        stockQuantity: sql`${schema.Products.stockQuantity} - ${item.quantity}`,
      })
      .where(eq(schema.Products.id, item.productId));
  }

  return { newTransaction, newOrder };
});
```

**Why a single transaction?**

- If any step fails, everything rolls back
- Prevents inventory overselling
- Ensures data consistency
- No orphaned records

#### Step 4: Payment Initialization

Same as donations - initialize Paystack payment and return URL

```typescript
const paystackResponse = await initializePaystackPayment({
  email: userEmail,
  amount: totalAmount * 100, // Convert to kobo/cents
  reference: paymentReference,
  currency,
  metadata: {
    orderId: newOrder.id,
    customerId: user.constituentId,
  },
});

return {
  order: {
    id: newOrder.id,
    totalAmount: newOrder.totalAmount,
    status: newOrder.status,
    items: validatedItems,
  },
  paymentUrl: paystackResponse.data.authorization_url,
};
```

#### Step 5: Order Status Update

When payment completes, update order status:

```typescript
async function updateOrderStatusOnPayment(transactionId: string) {
  // Find the order linked to this transaction
  const orderPayment = await dbClient.db.query.OrderPayments.findFirst({
    where: eq(schema.OrderPayments.transactionId, transactionId),
    with: {
      order: true,
    },
  });

  if (orderPayment && orderPayment.order.status === "PENDING") {
    // Update order status to PAID
    await dbClient.db
      .update(schema.Orders)
      .set({ status: "PAID" })
      .where(eq(schema.Orders.id, orderPayment.orderId));

    logger.info(`Order ${orderPayment.orderId} marked as PAID`);
  }
}
```

---

## Transaction Verification

### Manual Verification

Users can manually verify transaction status:

**Endpoint:** `POST /api/v1/transactions/:reference/verify`

**Flow:**

```typescript
export async function verifyTransaction(reference: string) {
  // 1. Find transaction by external reference
  const transaction = await dbClient.db.query.FinancialTransactions.findFirst({
    where: and(
      eq(schema.FinancialTransactions.externalProvider, "PAYSTACK"),
      eq(schema.FinancialTransactions.externalRef, reference),
    ),
  });

  if (!transaction) {
    throw new ApiError("Transaction not found", 404);
  }

  // 2. Call payment provider to get current status
  const provider = getPaymentProvider(transaction.externalProvider);
  const verifyResult = await provider.verifyTransaction(reference);

  // 3. Update transaction if status changed
  if (verifyResult.status !== transaction.status) {
    await dbClient.db
      .update(schema.FinancialTransactions)
      .set({
        status: verifyResult.status,
        paymentMethod: verifyResult.paymentMethod,
      })
      .where(eq(schema.FinancialTransactions.id, transaction.id));

    // 4. Send email if completed
    if (verifyResult.status === "COMPLETED") {
      await sendAcknowledgementEmail(transaction.id);
    }
  }

  return {
    transactionId: transaction.id,
    status: verifyResult.status,
    wasUpdated: verifyResult.status !== transaction.status,
  };
}
```

### Provider Abstraction

**Location:** `shared/services/paymentProviders.ts`

```typescript
export interface IPaymentProvider {
  name: string;
  verifyTransaction(reference: string): Promise<VerifyTransactionResult>;
  mapStatus(providerStatus: string): TransactionStatus;
  mapPaymentMethod(providerChannel: string): PaymentMethod;
}

export class PaystackProvider implements IPaymentProvider {
  name = "PAYSTACK";

  async verifyTransaction(reference: string) {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${variables.services.paystack.secretKey}`,
        },
      },
    );

    const data = await response.json();

    return {
      status: this.mapStatus(data.data.status),
      paymentMethod: this.mapPaymentMethod(data.data.channel),
      amount: (data.data.amount / 100).toFixed(2),
      currency: data.data.currency,
    };
  }

  mapStatus(providerStatus: string): TransactionStatus {
    const statusMap = {
      success: "COMPLETED",
      failed: "FAILED",
      abandoned: "FAILED",
      pending: "PENDING",
    };
    return statusMap[providerStatus] || "FAILED";
  }

  mapPaymentMethod(providerChannel: string): PaymentMethod {
    const methodMap = {
      card: "CREDIT_CARD",
      bank: "BANK_TRANSFER",
      mobile_money: "MOBILE_MONEY",
    };
    return methodMap[providerChannel] || "CREDIT_CARD";
  }
}
```

---

## Webhook Handling

### Paystack Webhook

**Endpoint:** `POST /api/v1/webhooks/paystack`

**Purpose:** Receive real-time payment status updates from Paystack

**Flow:**

```typescript
export async function handlePaystackWebhook(payload: PaystackWebhookPayload) {
  const { reference, status, channel, amount, currency } = payload.data;

  // Map provider status to internal status
  const newStatus = transactionStatusMap[status];
  const newPaymentMethod = paymentMethodMap[channel];

  // Update transaction (ONLY if status changed)
  const result = await dbClient.db
    .update(schema.FinancialTransactions)
    .set({
      status: newStatus,
      paymentMethod: newPaymentMethod,
      amount,
      currency,
    })
    .where(
      and(
        eq(schema.FinancialTransactions.externalProvider, "PAYSTACK"),
        eq(schema.FinancialTransactions.externalRef, reference),
        not(eq(schema.FinancialTransactions.status, newStatus)),
      ),
    )
    .returning();

  if (result.length > 0) {
    const transactionId = result[0].id;

    // Update order status if applicable
    if (newStatus === "COMPLETED") {
      await updateOrderStatusOnPayment(transactionId);
    }

    // Send appropriate email
    await sendTransactionStatusChangeEmail(transactionId, newStatus);

    return { wasUpdated: true, transactionId };
  }

  return { wasUpdated: false };
}
```

### Webhook Security

**Middleware:** `shared/middlewares/webhooks.ts`

```typescript
export function verifyPaystackSignature(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const hash = crypto
    .createHmac("sha512", variables.services.paystack.secretKey)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash === req.headers["x-paystack-signature"]) {
    return next();
  }

  return res.status(400).json({
    success: false,
    message: "Invalid signature",
  });
}
```

### Verification vs Webhook

| Aspect            | Verification Endpoint    | Webhook                            |
| ----------------- | ------------------------ | ---------------------------------- |
| **Initiated by**  | User/Frontend            | Payment Provider                   |
| **API Call**      | YES - calls provider API | NO - already verified by signature |
| **When to use**   | Manual status check      | Automatic real-time updates        |
| **Idempotency**   | Multiple calls safe      | Duplicate webhooks handled         |
| **Response time** | Depends on provider API  | Fast (no external calls)           |

---

## Email Notifications

### Email Types

1. **Donation Acknowledgement**

   ```typescript
   sendDonationAcknowledgementEmail(
     to: string,
     donorName: string,
     amount: string,
     currency: string,
     donationId: string
   )
   ```

2. **Dues Payment Acknowledgement**

   ```typescript
   sendDuesPaymentAcknowledgementEmail(
     to: string,
     memberName: string,
     amount: string,
     currency: string,
     duesId: string
   )
   ```

3. **Order Confirmation**

   ```typescript
   sendOrderConfirmationEmail(
     to: string,
     customerName: string,
     orderId: string,
     items: OrderItem[],
     totalAmount: string,
     currency: string
   )
   ```

4. **Transaction Failure**

   ```typescript
   sendTransactionFailureEmail(
     to: string,
     recipientName: string,
     amount: string,
     currency: string
   )
   ```

5. **Transaction Refund**
   ```typescript
   sendTransactionRefundEmail(
     to: string,
     recipientName: string,
     amount: string,
     currency: string,
     refundId: string
   )
   ```

### Email Sending Logic

**Location:** `shared/services/transactionsService.ts`

```typescript
async function sendTransactionStatusChangeEmail(
  transactionId: string,
  newStatus: TransactionStatus,
) {
  // Determine transaction type and recipient
  const transactionDetails = await getTransactionDetails(transactionId);

  switch (newStatus) {
    case "COMPLETED":
      if (transactionDetails.type === "donation") {
        await sendDonationAcknowledgementEmail(/* ... */);
      } else if (transactionDetails.type === "order") {
        await sendOrderConfirmationEmail(/* ... */);
      } else if (transactionDetails.type === "dues") {
        await sendDuesPaymentAcknowledgementEmail(/* ... */);
      }
      break;

    case "FAILED":
      await sendTransactionFailureEmail(/* ... */);
      break;

    case "REFUNDED":
      await sendTransactionRefundEmail(/* ... */);
      break;
  }
}
```

### Email Deduplication

To prevent duplicate emails, donations track acknowledgement status:

```typescript
// Check if email already sent
if (donation.acknowledgementSent) {
  return; // Skip sending
}

// Send email
await sendDonationAcknowledgementEmail(/* ... */);

// Mark as sent
await dbClient.db
  .update(schema.Donations)
  .set({ acknowledgementSent: true })
  .where(eq(schema.Donations.id, donation.id));
```

---

## Database Schema

### FinancialTransactions Table

```typescript
export const FinancialTransactions = finance.table("financial_transactions", {
  id: uuid().defaultRandom().primaryKey(),
  amount: decimal({ precision: 10, scale: 2 }).notNull(),
  currency: varchar({ length: 3 }).notNull(),
  transactionDate: timestamp("transaction_date", { withTimezone: true })
    .defaultNow()
    .notNull(),
  paymentMethod: PaymentMethod("payment_method"),
  status: TransactionStatus().default("PENDING").notNull(),
  externalProvider: ExternalProvider("external_provider"),
  externalRef: text("external_ref").unique(),
});
```

**Enums:**

- `PaymentMethod`: CREDIT_CARD, BANK_TRANSFER, MOBILE_MONEY, CASH
- `TransactionStatus`: PENDING, COMPLETED, FAILED, REFUNDED
- `ExternalProvider`: PAYSTACK

### Donations Table

```typescript
export const Donations = finance.table("donations", {
  id: uuid().defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id")
    .notNull()
    .unique()
    .references(() => FinancialTransactions.id, { onDelete: "restrict" }),
  constituentId: uuid("constituent_id").references(() => Constituents.id, {
    onDelete: "restrict",
  }),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "restrict",
  }),
  eventId: uuid("event_id").references(() => Events.id, {
    onDelete: "restrict",
  }),
  guestName: text("guest_name"),
  guestEmail: text("guest_email"),
  acknowledgementSent: boolean("acknowledgement_sent").default(false).notNull(),
});
```

### OrderPayments Table (Join Table)

```typescript
export const OrderPayments = shop.table("order_payments", {
  orderId: uuid("order_id")
    .notNull()
    .references(() => Orders.id, { onDelete: "cascade" }),
  transactionId: uuid("transaction_id")
    .notNull()
    .references(() => FinancialTransactions.id, { onDelete: "restrict" }),
});
```

---

## Error Handling

### Common Errors

1. **Insufficient Stock**

   ```typescript
   throw new ApiError(
     `Insufficient stock for "${product.name}". Only ${product.stockQuantity} available.`,
     400,
   );
   ```

2. **Invalid Product**

   ```typescript
   throw new ApiError(`Product with ID ${productId} not found`, 404);
   ```

3. **Payment Provider Error**

   ```typescript
   if (!paystackResponse.status) {
     throw new ApiError(
       `Paystack initialization failed: ${paystackResponse.message}`,
       500,
     );
   }
   ```

4. **Transaction Not Found**
   ```typescript
   if (!transaction) {
     throw new ApiError("Transaction not found", 404);
   }
   ```

### Error Recovery

1. **Transaction Rollback**: All database operations in transactions ensure atomicity
2. **Idempotent Operations**: Verification and webhooks can be called multiple times safely
3. **Email Failures**: Logged but don't fail the payment flow
4. **Stock Restoration**: If payment fails, stock is restored via transaction rollback

---

## Best Practices

### For Developers

1. **Always use transactions** for multi-step database operations
2. **Validate input early** before creating any records
3. **Use save-then-call pattern** for external API calls
4. **Handle idempotency** - check if operation already completed
5. **Log errors comprehensively** for debugging
6. **Send emails asynchronously** - don't block payment flow

### For Frontend Integration

1. **Never trust client calculations** - server validates everything
2. **Handle payment redirects** properly
3. **Implement verification polling** if webhook is delayed
4. **Show clear error messages** from API responses
5. **Store payment reference** for verification

### For Testing

1. **Use Paystack test keys** in development
2. **Test all edge cases** (insufficient stock, invalid products, etc.)
3. **Test webhook handling** with Paystack's webhook simulator
4. **Verify email sending** in test environment
5. **Check transaction atomicity** by simulating failures

---

## Conclusion

The financial transaction system in YPF Backend is designed for:

- **Reliability**: Database transactions ensure consistency
- **Scalability**: Save-then-call pattern prevents blocking
- **Extensibility**: Provider abstraction allows multiple payment gateways
- **Auditability**: Complete transaction history and status tracking
- **User Experience**: Real-time updates via webhooks and clear email notifications

Understanding these flows is essential for maintaining the payment system and implementing new features.

---

**Document Version:** 1.0  
**Last Updated:** November 8, 2025  
**Status:** Comprehensive Guide
