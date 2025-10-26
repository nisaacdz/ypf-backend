# Financial Transaction API Research & Recommendations

**Date:** October 26, 2025  
**Project:** YPF Backend  
**Author:** GitHub Copilot

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Payment API Research](#payment-api-research)
4. [Comparative Analysis](#comparative-analysis)
5. [Integration Strategy](#integration-strategy)
6. [Recommended Architecture Changes](#recommended-architecture-changes)
7. [Security & Compliance](#security--compliance)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Appendices](#appendices)

---

## Executive Summary

### Key Findings

After comprehensive analysis of the YPF Backend codebase and extensive research into third-party payment APIs, we recommend a **dual-provider approach**:

1. **Primary Provider: Stripe** - For international payments, donations, and e-commerce
2. **Regional Provider: Flutterwave** - For African mobile money and local payment methods

### Rationale

- **Current Architecture**: The class table inheritance pattern is well-designed and compatible with modern payment APIs
- **Use Case Coverage**: Supports donations, dues payments, shop purchases, and future transaction types
- **Regional Requirements**: Strong African market presence (mobile money critical for user adoption)
- **Developer Experience**: Excellent SDKs, documentation, and TypeScript support
- **Auditability**: Built-in compliance, reporting, and webhook infrastructure

### Investment Required

- Development Time: ~3-4 weeks for full integration
- Monthly Costs: $0 base + transaction fees (2.9% + $0.30 for Stripe, 3.8% for Flutterwave)
- No upfront infrastructure costs

---

## Current Architecture Analysis

### Database Schema Overview

The YPF Backend uses a sophisticated **class table inheritance** pattern for financial transactions:

```
FinancialTransactions (Parent Table)
├── Donations
├── DuesPayments
└── [Future: ShopPurchases, Refunds, etc.]
```

#### Core Tables

**1. FinancialTransactions** (`finance.financial_transactions`)
- **Purpose**: Parent table for all financial transactions
- **Key Fields**:
  - `id` (UUID): Unique transaction identifier
  - `amount` (DECIMAL): Transaction amount
  - `currency` (VARCHAR(3)): ISO 4217 currency code
  - `transactionDate` (TIMESTAMP): When transaction occurred
  - `paymentMethod` (ENUM): CREDIT_CARD, BANK_TRANSFER, MOBILE_MONEY, CASH
  - `status` (ENUM): PENDING, COMPLETED, FAILED, REFUNDED
  - `externalRef` (TEXT): External payment provider reference

**Strengths:**
- Clean separation of concerns
- Extensible for new transaction types
- Foreign key constraints ensure data integrity
- Timezone-aware timestamps for global operations

**2. Donations** (`finance.donations`)
- Links transactions to donors, projects, and events
- Supports anonymous donations (nullable `donorId`)
- Flexible attribution to projects or events

**3. DuesPayments** (`finance.dues_payments`)
- Tracks membership dues by period
- Links members to specific dues obligations
- Supports chapter-specific dues

**4. Shop Schema** (`shop.orders`, `shop.order_items`, `shop.products`)
- E-commerce infrastructure in place
- Order tracking with status management
- **Missing**: Link between Orders and FinancialTransactions

### Current Gaps

1. **No Shop Transaction Link**: Orders table doesn't reference FinancialTransactions
2. **Limited Payment Methods**: Enums don't cover digital wallets, buy-now-pay-later
3. **No Webhook Infrastructure**: Missing endpoint handlers for payment provider callbacks
4. **No Refund Tracking**: Status exists but no detailed refund metadata
5. **Currency Handling**: No exchange rate tracking for multi-currency support

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express 5.x
- **ORM**: Drizzle ORM (PostgreSQL)
- **Database**: PostgreSQL with schemas
- **Validation**: Zod
- **Testing**: Vitest with pg-mem

**Strengths for Integration:**
- Type-safe ORM with excellent TypeScript support
- Schema-based organization (easy to add finance webhooks)
- Existing middleware infrastructure (auth, validation, error handling)
- Rate limiting already implemented

---

## Payment API Research

### 1. Stripe

**Overview**: Market leader in payment processing with comprehensive API coverage.

#### Strengths

✅ **Feature Completeness**
- One-time payments, subscriptions, invoicing
- 135+ currencies, 45+ payment methods
- Built-in fraud detection (Stripe Radar)
- Comprehensive webhook system
- PCI-DSS Level 1 certified

✅ **Developer Experience**
- Excellent TypeScript SDK (`stripe` npm package)
- Detailed documentation and API reference
- Sandbox environment for testing
- Idempotency built-in
- Clear versioning (dated API versions)

✅ **Donations Support**
- Purpose-built donation forms
- Recurring donation support
- Donor management via Customer objects
- Tax receipt generation capabilities

✅ **E-commerce Support**
- Payment Intents API for one-time purchases
- Shopping cart integration
- Inventory management webhooks
- Automatic receipt emails

✅ **Compliance & Auditing**
- Complete transaction logs
- Dispute management
- Detailed reporting dashboard
- Export capabilities for accounting software

#### Limitations

❌ **African Market Coverage**
- Limited mobile money support in Africa
- No direct M-Pesa integration (Kenya)
- No MTN Mobile Money (Uganda, Ghana, etc.)
- Higher transaction fees for African cards

❌ **Pricing**
- 2.9% + $0.30 per successful card charge (US)
- 3.9% + $0.30 for international cards
- Additional 1% for currency conversion
- Higher fees may impact donation amounts

#### Integration Complexity: **Medium**
- Requires webhook endpoints
- Payment Intent workflow (client-side + server-side)
- Strong idempotency and retry handling needed

#### Code Example

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-10-28',
  typescript: true,
});

// Create a donation payment intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: 5000, // $50.00 in cents
  currency: 'usd',
  payment_method_types: ['card'],
  metadata: {
    donorId: 'donor_123',
    projectId: 'project_456',
    transactionType: 'donation',
  },
});
```

---

### 2. PayPal

**Overview**: Widely recognized payment platform with strong consumer trust.

#### Strengths

✅ **Brand Recognition**
- High user trust and familiarity
- 430M+ active accounts globally
- One-click checkout for existing users

✅ **Donations Features**
- PayPal Giving Fund integration
- Recurring donations support
- Donor-covered fees option

✅ **API Features**
- Orders API for e-commerce
- Subscriptions API for recurring payments
- Webhooks for transaction events

✅ **TypeScript Support**
- Official `@paypal/checkout-server-sdk` package
- Sandbox environment

#### Limitations

❌ **Developer Experience**
- More complex API structure than Stripe
- SDK documentation less comprehensive
- Frequent API changes and deprecations

❌ **African Coverage**
- Limited presence in Africa (only South Africa, Egypt, Morocco)
- No mobile money integration
- Currency support limited

❌ **Pricing**
- 3.49% + $0.49 per transaction (US)
- Higher fees for micropayments
- International transaction fees add 1.5%

❌ **Account Requirements**
- Users must have PayPal accounts (friction for new donors)
- Or guest checkout with additional fees

#### Integration Complexity: **Medium-High**
- OAuth flow for seller onboarding
- Webhook verification can be complex
- Two-step API calls (create order, capture order)

---

### 3. Flutterwave

**Overview**: Leading African payment gateway with comprehensive mobile money support.

#### Strengths

✅ **African Market Focus**
- Operates in 34+ African countries
- M-Pesa, MTN Mobile Money, Airtel Money support
- Local payment methods (Ghana Mobile Money, Rwanda Mobile Money, etc.)
- Bank transfers in local currencies

✅ **Payment Methods**
- Mobile money (primary use case)
- Cards (Visa, Mastercard, Verve)
- Bank accounts (direct debit)
- USSD payments

✅ **Developer Experience**
- Clean REST API
- Node.js SDK available (`flutterwave-node-v3`)
- Good documentation
- Test environment with sample credentials

✅ **Compliance**
- PCI-DSS compliant
- Licensed in multiple African jurisdictions
- KYC/AML capabilities

✅ **Features**
- Payment links for donations
- Subscriptions for recurring payments
- Split payments (useful for multi-chapter organizations)
- Virtual accounts

#### Limitations

❌ **Global Coverage**
- Primarily Africa-focused
- Limited support outside Africa
- Not suitable as sole provider for international org

❌ **TypeScript Support**
- SDK exists but type definitions incomplete
- May require custom type declarations

❌ **Pricing**
- 3.8% per transaction (Africa)
- Additional fees for withdrawals
- Currency conversion fees apply

#### Integration Complexity: **Low-Medium**
- Simpler API than Stripe
- Webhook implementation straightforward
- Transaction reference tracking required

#### Code Example

```typescript
import Flutterwave from 'flutterwave-node-v3';

const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY,
  process.env.FLW_SECRET_KEY
);

// Initiate mobile money payment
const payload = {
  phone_number: '254712345678',
  amount: 5000, // KES 5000
  currency: 'KES',
  email: 'donor@example.com',
  tx_ref: generateTxRef(),
  redirect_url: 'https://yourdomain.com/callback',
  payment_options: 'mobilemoneykenya',
  meta: {
    donorId: 'donor_123',
    projectId: 'project_456',
  },
};

const response = await flw.MobileMoney.kenya(payload);
```

---

### 4. Paystack

**Overview**: Nigerian payment gateway (acquired by Stripe) with African focus.

#### Strengths

✅ **African Coverage**
- Nigeria, Ghana, South Africa, Kenya
- Mobile money support
- Bank transfers, USSD, cards

✅ **Stripe Integration**
- Same parent company as Stripe
- Similar API design patterns
- Potential for unified integration

✅ **Developer Experience**
- Clean API design
- Node.js SDK available
- Good documentation

✅ **Features**
- Recurring payments via subscriptions
- Split payments
- Payment pages (hosted checkout)

#### Limitations

❌ **Limited Regional Coverage**
- Only 4 African countries
- Not pan-African like Flutterwave

❌ **Acquisition Uncertainty**
- Future integration with Stripe unclear
- Long-term product roadmap uncertain

❌ **Pricing**
- 1.5% - 2% per transaction (Nigeria)
- Varies by country and volume

#### Integration Complexity: **Low-Medium**
- Similar to Stripe if familiar
- Webhook verification straightforward

---

### 5. Square

**Overview**: Point-of-sale and online payment platform.

#### Strengths

✅ **E-commerce Focus**
- Excellent for online shops
- Inventory management
- Order management built-in

✅ **Developer Tools**
- Strong SDK support
- GraphQL API option
- Good TypeScript types

#### Limitations

❌ **Geographic Coverage**
- US, Canada, UK, Australia, Japan focus
- No African presence
- Not suitable for YPF's user base

❌ **Donations**
- Not optimized for nonprofit use cases
- No specialized donation features

---

### 6. African Mobile Money APIs

#### M-Pesa (Safaricom - Kenya)

**Strengths:**
- Market dominance in Kenya (80%+ adoption)
- Direct API integration possible
- Lower fees than aggregators

**Limitations:**
- Kenya-only
- Complex developer onboarding (requires business registration)
- Sandbox can be unreliable
- Technical documentation challenges

#### MTN Mobile Money

**Strengths:**
- 45M+ users across Africa
- Available in 20+ countries

**Limitations:**
- Separate integration per country
- Inconsistent API across regions
- Developer access difficult

---

## Comparative Analysis

### Feature Comparison Matrix

| Feature | Stripe | PayPal | Flutterwave | Paystack | Square |
|---------|--------|--------|-------------|----------|--------|
| **One-time Payments** | ✅ Excellent | ✅ Good | ✅ Excellent | ✅ Good | ✅ Good |
| **Recurring Payments** | ✅ Excellent | ✅ Good | ✅ Good | ✅ Good | ✅ Good |
| **Donations Optimized** | ✅ Yes | ✅ Yes | ⚠️ Partial | ⚠️ Partial | ❌ No |
| **E-commerce Support** | ✅ Excellent | ✅ Good | ✅ Good | ✅ Good | ✅ Excellent |
| **Mobile Money (Africa)** | ❌ No | ❌ No | ✅ Excellent | ✅ Good | ❌ No |
| **African Coverage** | ⚠️ Limited | ⚠️ Minimal | ✅ Excellent | ⚠️ 4 countries | ❌ None |
| **Global Coverage** | ✅ Excellent | ✅ Excellent | ⚠️ Africa only | ⚠️ Africa only | ⚠️ Limited |
| **TypeScript SDK** | ✅ Excellent | ✅ Good | ⚠️ Basic | ✅ Good | ✅ Good |
| **Documentation** | ✅ Excellent | ⚠️ Good | ✅ Good | ✅ Good | ✅ Good |
| **Webhook Support** | ✅ Excellent | ✅ Good | ✅ Good | ✅ Good | ✅ Good |
| **PCI Compliance** | ✅ Level 1 | ✅ Level 1 | ✅ Certified | ✅ Certified | ✅ Level 1 |
| **Fraud Detection** | ✅ Built-in | ✅ Built-in | ✅ Basic | ✅ Basic | ✅ Built-in |
| **Developer Experience** | ✅ Excellent | ⚠️ Good | ✅ Good | ✅ Good | ✅ Good |

### Pricing Comparison

#### Card Payments (One-time)

| Provider | Domestic Cards | International Cards | Notes |
|----------|----------------|---------------------|-------|
| Stripe | 2.9% + $0.30 | 3.9% + $0.30 | Additional 1% for currency conversion |
| PayPal | 3.49% + $0.49 | 4.99% + $0.49 | Lower fees for nonprofits available |
| Flutterwave | 3.8% | 3.8% | Flat rate for African cards |
| Paystack | 1.5% - 2% | 2.5% - 3.5% | Volume discounts available |
| Square | 2.9% + $0.30 | N/A | Limited regional support |

#### Mobile Money (Africa)

| Provider | Fee | Coverage |
|----------|-----|----------|
| Flutterwave | 3.8% | 34+ countries |
| Paystack | 1.5% - 2% | 4 countries |
| M-Pesa Direct | 1% - 1.5% | Kenya only |

#### Recurring Payments

| Provider | Fee | Notes |
|----------|-----|-------|
| Stripe | 2.9% + $0.30/charge | Subscriptions built-in |
| PayPal | 3.49% + $0.49/charge | Subscription API |
| Flutterwave | 3.8%/charge | Subscription plans supported |

---

## Integration Strategy

### Recommended Approach: Dual Provider

**Primary: Stripe** - For international donors and card payments  
**Regional: Flutterwave** - For African users and mobile money

#### Rationale

1. **User Experience**: Donors choose payment method, system routes to appropriate provider
2. **Cost Optimization**: Lower fees for mobile money via Flutterwave
3. **Market Coverage**: Complete coverage for both global and African users
4. **Risk Mitigation**: Not dependent on single provider
5. **Feature Access**: Leverage best features of each provider

### Architecture Overview

```
┌─────────────────┐
│   User/Donor    │
└────────┬────────┘
         │
         ▼
┌────────────────────────────────────┐
│  Payment Intent Creation Endpoint  │
│  POST /api/v1/transactions/initiate│
└────────┬───────────────────────────┘
         │
    ┌────┴────┐
    │ Routing │
    │  Logic  │
    └────┬────┘
         │
    ┌────┴──────────────────────┐
    │                           │
    ▼                           ▼
┌─────────┐              ┌──────────────┐
│ Stripe  │              │ Flutterwave  │
│   API   │              │     API      │
└────┬────┘              └──────┬───────┘
     │                          │
     │  Webhooks                │  Webhooks
     │                          │
     ▼                          ▼
┌────────────────────────────────────┐
│   Webhook Handler Endpoints        │
│   POST /api/v1/webhooks/stripe     │
│   POST /api/v1/webhooks/flutterwave│
└────────┬───────────────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Transaction Recording   │
│  (FinancialTransactions) │
└──────────────────────────┘
```

### Payment Flow

#### 1. Donation Flow

```typescript
// User initiates donation
POST /api/v1/donations/initiate
{
  "amount": 5000,
  "currency": "USD",
  "donorId": "donor_123",
  "projectId": "project_456",
  "paymentMethod": "CREDIT_CARD" | "MOBILE_MONEY",
  "mobileMoneyProvider": "M-PESA" // if applicable
}

// Server creates FinancialTransaction (status: PENDING)
const transaction = await createFinancialTransaction({
  amount: 5000,
  currency: "USD",
  paymentMethod: "CREDIT_CARD",
  status: "PENDING"
});

// Route to appropriate provider
if (paymentMethod === "CREDIT_CARD") {
  const intent = await stripe.paymentIntents.create({
    amount: 5000,
    currency: "usd",
    metadata: { transactionId: transaction.id }
  });
  
  // Return client secret for frontend
  return { clientSecret: intent.client_secret };
  
} else if (paymentMethod === "MOBILE_MONEY") {
  const payment = await flutterwave.initiatePayment({
    amount: 5000,
    currency: "KES",
    meta: { transactionId: transaction.id }
  });
  
  return { paymentUrl: payment.link };
}

// Create Donation record linked to transaction
await createDonation({
  transactionId: transaction.id,
  donorId: "donor_123",
  projectId: "project_456"
});
```

#### 2. Shop Purchase Flow

```typescript
// User places order
POST /api/v1/shop/orders
{
  "items": [
    { "productId": "prod_1", "quantity": 2 },
    { "productId": "prod_2", "quantity": 1 }
  ],
  "paymentMethod": "CREDIT_CARD",
  "deliveryAddress": { ... }
}

// Server creates Order
const order = await createOrder({
  customerId: userId,
  totalAmount: 7500,
  status: "PENDING"
});

// Create FinancialTransaction
const transaction = await createFinancialTransaction({
  amount: 7500,
  currency: "USD",
  paymentMethod: "CREDIT_CARD",
  status: "PENDING"
});

// Link Order to Transaction (NEW TABLE NEEDED)
await createShopPurchase({
  transactionId: transaction.id,
  orderId: order.id
});

// Process payment with provider...
```

#### 3. Dues Payment Flow

```typescript
// Member pays dues
POST /api/v1/finance/dues/pay
{
  "duesId": "dues_2024_annual",
  "memberId": "member_123",
  "amount": 10000,
  "paymentMethod": "BANK_TRANSFER"
}

// Create transaction and dues payment record
const transaction = await createFinancialTransaction({
  amount: 10000,
  currency: "USD",
  paymentMethod: "BANK_TRANSFER",
  status: "PENDING"
});

await createDuesPayment({
  transactionId: transaction.id,
  duesId: "dues_2024_annual",
  memberId: "member_123"
});

// Process payment...
```

### Webhook Handling

#### Stripe Webhook Handler

```typescript
// POST /api/v1/webhooks/stripe
import { Router } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

router.post('/webhooks/stripe', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    try {
      // Verify webhook signature
      const event = stripe.webhooks.constructEvent(
        req.body, 
        sig, 
        webhookSecret
      );
      
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSuccess(event.data.object);
          break;
          
        case 'payment_intent.payment_failed':
          await handlePaymentFailure(event.data.object);
          break;
          
        case 'charge.refunded':
          await handleRefund(event.data.object);
          break;
      }
      
      res.json({ received: true });
      
    } catch (err) {
      logger.error('Webhook error:', err);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const transactionId = paymentIntent.metadata.transactionId;
  
  await db.update(FinancialTransactions)
    .set({
      status: 'COMPLETED',
      externalRef: paymentIntent.id
    })
    .where(eq(FinancialTransactions.id, transactionId));
    
  // Send confirmation email, update order status, etc.
}
```

#### Flutterwave Webhook Handler

```typescript
// POST /api/v1/webhooks/flutterwave
import crypto from 'crypto';

router.post('/webhooks/flutterwave', async (req, res) => {
  const secretHash = process.env.FLW_SECRET_HASH;
  const signature = req.headers['verif-hash'];
  
  // Verify webhook
  if (signature !== secretHash) {
    return res.status(401).send('Invalid signature');
  }
  
  const payload = req.body;
  
  if (payload.status === 'successful') {
    const transactionId = payload.meta.transactionId;
    
    await db.update(FinancialTransactions)
      .set({
        status: 'COMPLETED',
        externalRef: payload.tx_ref
      })
      .where(eq(FinancialTransactions.id, transactionId));
  }
  
  res.status(200).send('OK');
});
```

---

## Recommended Architecture Changes

### 1. Database Schema Updates

#### A. Add ShopPurchases Table

```typescript
// db/schema/finance.ts

export const ShopPurchases = finance.table("shop_purchases", {
  id: uuid().defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id")
    .notNull()
    .unique()
    .references(() => FinancialTransactions.id, { onDelete: "restrict" }),
  orderId: uuid("order_id")
    .notNull()
    .references(() => Orders.id, { onDelete: "restrict" }),
});

export const shopPurchasesRelations = relations(ShopPurchases, ({ one }) => ({
  transaction: one(FinancialTransactions, {
    fields: [ShopPurchases.transactionId],
    references: [FinancialTransactions.id],
  }),
  order: one(Orders, {
    fields: [ShopPurchases.orderId],
    references: [Orders.id],
  }),
}));
```

#### B. Extend FinancialTransactions

```typescript
// Add new fields to FinancialTransactions table

export const FinancialTransactions = finance.table("financial_transactions", {
  id: uuid().defaultRandom().primaryKey(),
  amount: decimal({ precision: 10, scale: 2 }).notNull(),
  currency: varchar({ length: 3 }).notNull(),
  transactionDate: timestamp("transaction_date", { withTimezone: true })
    .defaultNow()
    .notNull(),
  paymentMethod: PaymentMethod("payment_method").notNull(),
  status: TransactionStatus().default("PENDING").notNull(),
  externalRef: text("external_ref"), // Existing
  
  // NEW FIELDS
  provider: varchar({ length: 50 }), // 'stripe', 'flutterwave', 'manual'
  providerFee: decimal({ precision: 10, scale: 2 }), // For fee tracking
  netAmount: decimal({ precision: 10, scale: 2 }), // amount - providerFee
  metadata: jsonb(), // Flexible JSON for provider-specific data
  failureReason: text("failure_reason"), // For failed transactions
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

#### C. Add WebhookEvents Table (Audit Trail)

```typescript
// db/schema/finance.ts

export const WebhookEvents = finance.table("webhook_events", {
  id: uuid().defaultRandom().primaryKey(),
  provider: varchar({ length: 50 }).notNull(), // 'stripe', 'flutterwave'
  eventType: text("event_type").notNull(), // e.g., 'payment_intent.succeeded'
  eventId: text("event_id").notNull().unique(), // Provider's event ID
  payload: jsonb().notNull(), // Full webhook payload
  processed: boolean().default(false).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  transactionId: uuid("transaction_id").references(
    () => FinancialTransactions.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

#### D. Update Payment Method Enum

```typescript
// db/schema/enums.ts

export const PaymentMethod = pgEnum("payment_method", [
  "CREDIT_CARD",
  "DEBIT_CARD",
  "BANK_TRANSFER",
  "MOBILE_MONEY_MPESA",
  "MOBILE_MONEY_MTN",
  "MOBILE_MONEY_AIRTEL",
  "MOBILE_MONEY_VODAFONE",
  "PAYPAL",
  "APPLE_PAY",
  "GOOGLE_PAY",
  "CASH",
  "OTHER",
]);
```

### 2. Configuration Updates

#### A. Environment Variables

```typescript
// configs/env.ts

const envSchema = z
  .object({
    // ... existing fields ...
    
    // Stripe Configuration
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    
    // Flutterwave Configuration
    FLUTTERWAVE_PUBLIC_KEY: z.string().min(1).optional(),
    FLUTTERWAVE_SECRET_KEY: z.string().min(1).optional(),
    FLUTTERWAVE_ENCRYPTION_KEY: z.string().min(1).optional(),
    FLUTTERWAVE_WEBHOOK_SECRET: z.string().min(1).optional(),
  })
  .transform((env) => ({
    // ... existing transformations ...
    
    payments: {
      stripe: {
        secretKey: env.STRIPE_SECRET_KEY,
        publishableKey: env.STRIPE_PUBLISHABLE_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
        enabled: !!env.STRIPE_SECRET_KEY,
      },
      flutterwave: {
        publicKey: env.FLUTTERWAVE_PUBLIC_KEY,
        secretKey: env.FLUTTERWAVE_SECRET_KEY,
        encryptionKey: env.FLUTTERWAVE_ENCRYPTION_KEY,
        webhookSecret: env.FLUTTERWAVE_WEBHOOK_SECRET,
        enabled: !!env.FLUTTERWAVE_SECRET_KEY,
      },
    },
  }));
```

#### B. Payment Provider Initialization

```typescript
// configs/payments/index.ts

import Stripe from 'stripe';
import Flutterwave from 'flutterwave-node-v3';
import variables from '@/configs/env';

export const stripe = variables.payments.stripe.enabled
  ? new Stripe(variables.payments.stripe.secretKey!, {
      apiVersion: '2024-10-28',
      typescript: true,
    })
  : null;

export const flutterwave = variables.payments.flutterwave.enabled
  ? new Flutterwave(
      variables.payments.flutterwave.publicKey!,
      variables.payments.flutterwave.secretKey!
    )
  : null;
```

### 3. Service Layer

#### A. Payment Service

```typescript
// shared/services/paymentsService.ts

import { stripe, flutterwave } from '@/configs/payments';
import { db } from '@/configs/db';
import { FinancialTransactions } from '@/db/schema/finance';

export type PaymentProvider = 'stripe' | 'flutterwave' | 'manual';

export interface InitiatePaymentParams {
  amount: number;
  currency: string;
  paymentMethod: string;
  provider: PaymentProvider;
  metadata: {
    transactionType: 'donation' | 'dues' | 'shop_purchase';
    [key: string]: any;
  };
}

export async function initiatePayment(params: InitiatePaymentParams) {
  // Create pending transaction record
  const transaction = await db
    .insert(FinancialTransactions)
    .values({
      amount: params.amount.toString(),
      currency: params.currency,
      paymentMethod: params.paymentMethod,
      status: 'PENDING',
      provider: params.provider,
      metadata: params.metadata,
    })
    .returning();

  const transactionId = transaction[0].id;

  // Route to appropriate provider
  if (params.provider === 'stripe' && stripe) {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100), // Convert to cents
      currency: params.currency.toLowerCase(),
      metadata: {
        transactionId,
        ...params.metadata,
      },
    });

    // Update transaction with external reference
    await db
      .update(FinancialTransactions)
      .set({ externalRef: paymentIntent.id })
      .where(eq(FinancialTransactions.id, transactionId));

    return {
      transactionId,
      clientSecret: paymentIntent.client_secret,
      provider: 'stripe',
    };
  } else if (params.provider === 'flutterwave' && flutterwave) {
    const payload = {
      tx_ref: transactionId,
      amount: params.amount,
      currency: params.currency,
      redirect_url: `${variables.app.host}/api/v1/payments/callback`,
      meta: params.metadata,
      customer: {
        email: params.metadata.email || 'donor@ypf.org',
      },
      customizations: {
        title: 'YPF Payment',
        logo: variables.app.logoUrl,
      },
    };

    const response = await flutterwave.Charge.card(payload);

    return {
      transactionId,
      paymentUrl: response.meta.authorization.redirect,
      provider: 'flutterwave',
    };
  }

  throw new Error(`Payment provider ${params.provider} not configured`);
}

export async function handleSuccessfulPayment(
  transactionId: string,
  externalRef: string,
  providerFee?: number
) {
  // First, fetch the transaction to get the current amount
  const existingTransaction = await db.query.FinancialTransactions.findFirst({
    where: eq(FinancialTransactions.id, transactionId),
  });

  if (!existingTransaction) {
    throw new Error('Transaction not found');
  }

  // Calculate net amount if provider fee is provided
  const netAmount = providerFee
    ? (parseFloat(existingTransaction.amount) - providerFee).toString()
    : undefined;

  const transaction = await db
    .update(FinancialTransactions)
    .set({
      status: 'COMPLETED',
      externalRef,
      providerFee: providerFee?.toString(),
      netAmount,
      updatedAt: new Date(),
    })
    .where(eq(FinancialTransactions.id, transactionId))
    .returning();

  return transaction[0];
}

export async function handleFailedPayment(
  transactionId: string,
  reason: string
) {
  await db
    .update(FinancialTransactions)
    .set({
      status: 'FAILED',
      failureReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(FinancialTransactions.id, transactionId));
}

export async function processRefund(
  transactionId: string,
  amount?: number,
  reason?: string
) {
  const transaction = await db.query.FinancialTransactions.findFirst({
    where: eq(FinancialTransactions.id, transactionId),
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (transaction.status !== 'COMPLETED') {
    throw new Error('Can only refund completed transactions');
  }

  const refundAmount = amount || parseFloat(transaction.amount);

  // Process refund with provider
  if (transaction.provider === 'stripe' && stripe && transaction.externalRef) {
    const refund = await stripe.refunds.create({
      payment_intent: transaction.externalRef,
      amount: Math.round(refundAmount * 100),
      reason: 'requested_by_customer',
    });

    await db
      .update(FinancialTransactions)
      .set({
        status: 'REFUNDED',
        refundedAt: new Date(),
        refundAmount: refundAmount.toString(),
        updatedAt: new Date(),
      })
      .where(eq(FinancialTransactions.id, transactionId));

    return refund;
  }

  throw new Error('Refund not supported for this provider');
}
```

### 4. API Routes

#### A. Payment Initiation Endpoint

```typescript
// features/api/v1/payments/initiate.ts

import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '@/shared/middlewares/validate';
import { initiatePayment } from '@/shared/services/paymentsService';
import { authenticate } from '@/shared/middlewares/auth';

const router = Router();

const initiatePaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  paymentMethod: z.string(),
  provider: z.enum(['stripe', 'flutterwave']),
  transactionType: z.enum(['donation', 'dues', 'shop_purchase']),
  metadata: z.record(z.any()).optional(),
});

router.post(
  '/initiate',
  authenticate,
  validateBody(initiatePaymentSchema),
  async (req, res, next) => {
    try {
      const result = await initiatePayment({
        ...req.Body,
        metadata: {
          transactionType: req.Body.transactionType,
          userId: req.user.id,
          ...req.Body.metadata,
        },
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

#### B. Webhook Endpoints

```typescript
// features/api/v1/webhooks/index.ts

import { Router } from 'express';
import express from 'express';
import stripeWebhook from './stripe';
import flutterwaveWebhook from './flutterwave';

const router = Router();

// Use raw body for webhook verification
router.use('/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
router.use('/flutterwave', flutterwaveWebhook);

export default router;
```

```typescript
// features/api/v1/webhooks/stripe.ts

import { Router } from 'express';
import Stripe from 'stripe';
import { stripe } from '@/configs/payments';
import variables from '@/configs/env';
import { handleSuccessfulPayment, handleFailedPayment } from '@/shared/services/paymentsService';
import { db } from '@/configs/db';
import { WebhookEvents } from '@/db/schema/finance';

const router = Router();

router.post('/', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'] as string;

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      variables.payments.stripe.webhookSecret!
    );

    // Log webhook event for audit
    await db.insert(WebhookEvents).values({
      provider: 'stripe',
      eventType: event.type,
      eventId: event.id,
      payload: event as any,
      processed: false,
    });

    // Handle event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const transactionId = paymentIntent.metadata.transactionId;
        
        await handleSuccessfulPayment(
          transactionId,
          paymentIntent.id,
          paymentIntent.charges.data[0]?.balance_transaction
            ? undefined // Would need to fetch balance transaction for exact fee
            : undefined
        );
        
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const transactionId = paymentIntent.metadata.transactionId;
        
        await handleFailedPayment(
          transactionId,
          paymentIntent.last_payment_error?.message || 'Payment failed'
        );
        
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        // Handle refund logic
        break;
      }
    }

    // Mark event as processed
    await db
      .update(WebhookEvents)
      .set({ processed: true, processedAt: new Date() })
      .where(eq(WebhookEvents.eventId, event.id));

    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
```

### 5. Frontend Integration Patterns

#### Stripe Elements (React Example)

```typescript
// Frontend example (for reference)
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_...');

function DonationForm() {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Create payment intent on backend
    const { clientSecret } = await fetch('/api/v1/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 50,
        currency: 'usd',
        provider: 'stripe',
        transactionType: 'donation',
      }),
    }).then(r => r.json());

    // Confirm payment on client
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement),
      },
    });

    if (result.error) {
      // Handle error
    } else {
      // Payment successful
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button type="submit">Donate $50</button>
    </form>
  );
}
```

---

## Security & Compliance

### PCI-DSS Compliance

**Strategy: Never Touch Card Data**

By using Stripe Elements or Flutterwave's hosted checkout, card data never touches our servers, maintaining PCI-DSS compliance without requiring Level 1 certification.

✅ **Implementation:**
- Use Stripe.js and Elements for card collection
- Use Flutterwave's hosted payment pages
- Never log or store raw card numbers
- Use tokens/payment methods only

### Webhook Security

#### 1. Signature Verification

**Stripe:**
```typescript
const event = stripe.webhooks.constructEvent(
  req.body,
  signature,
  webhookSecret
);
// Automatically verifies signature
```

**Flutterwave:**
```typescript
const secretHash = process.env.FLW_SECRET_HASH;
if (req.headers['verif-hash'] !== secretHash) {
  throw new Error('Invalid signature');
}
```

#### 2. Idempotency

**Problem:** Webhook may be delivered multiple times

**Solution:**
```typescript
// Use webhook event ID as idempotency key
const existingEvent = await db.query.WebhookEvents.findFirst({
  where: eq(WebhookEvents.eventId, event.id)
});

if (existingEvent && existingEvent.processed) {
  return res.json({ received: true }); // Already processed
}

// Process event...
```

#### 3. Rate Limiting

Apply stricter rate limits to webhook endpoints:

```typescript
router.use('/webhooks', rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // Allow bursts from providers
}));
```

### Data Protection

1. **Encryption at Rest**: PostgreSQL's transparent data encryption for sensitive fields
2. **Encryption in Transit**: HTTPS only (enforced by Helmet middleware)
3. **Access Control**: Authenticate all payment initiation requests
4. **Audit Logging**: `WebhookEvents` table provides complete audit trail
5. **PII Minimization**: Don't store unnecessary customer data

### Compliance Considerations

#### GDPR (if serving EU users)
- Allow users to request data deletion
- Maintain transaction records for legal compliance (7 years)
- Provide data export functionality
- Get explicit consent for data processing

#### Regional Regulations
- **Nigeria**: NDPR (Nigeria Data Protection Regulation)
- **Kenya**: Data Protection Act 2019
- **South Africa**: POPIA (Protection of Personal Information Act)

**Recommendations:**
- Add terms of service acceptance to payment flows
- Implement data retention policies
- Provide privacy policy clearly
- Partner with legal counsel for multi-country operations

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goals:** Set up providers and database

- [ ] Add Stripe and Flutterwave npm packages
- [ ] Configure environment variables
- [ ] Create database migration for schema changes
- [ ] Initialize payment provider clients
- [ ] Set up test accounts and webhooks endpoints

**Deliverables:**
- Updated `package.json` with dependencies
- Environment configuration in `.env.example`
- Database migration script
- Provider initialization in `configs/payments`

### Phase 2: Core Payment Service (Week 2)

**Goals:** Implement payment initiation and processing

- [ ] Build `paymentsService.ts` with provider routing
- [ ] Implement transaction creation logic
- [ ] Add webhook handler infrastructure
- [ ] Create webhook event logging
- [ ] Implement basic error handling

**Deliverables:**
- Working payment initiation endpoint
- Webhook receivers for both providers
- Transaction status updates on webhook events
- Unit tests for service layer

### Phase 3: Transaction Types Integration (Week 3)

**Goals:** Connect payments to donations, dues, shop

- [ ] Update donations API to use payment service
- [ ] Implement dues payment integration
- [ ] Add shop purchase payment flow
- [ ] Create refund functionality
- [ ] Add failure handling and retries

**Deliverables:**
- Updated API endpoints for all transaction types
- Shop purchase table and relations
- Refund API endpoint
- Integration tests

### Phase 4: Testing & Documentation (Week 4)

**Goals:** Comprehensive testing and developer docs

- [ ] End-to-end tests for payment flows
- [ ] Webhook simulation tests
- [ ] Load testing for concurrent payments
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Developer integration guide
- [ ] Runbook for production operations

**Deliverables:**
- Test suite with >80% coverage
- Updated API documentation
- Developer guide for adding new transaction types
- Operations manual for monitoring/troubleshooting

### Phase 5: Production Rollout (Post-Development)

**Recommended Approach: Gradual Rollout**

1. **Internal Testing** (1 week)
   - Use with test accounts only
   - Process small transactions
   - Monitor logs and webhook delivery

2. **Beta Testing** (2 weeks)
   - Select group of trusted users
   - Limit transaction amounts
   - Collect feedback on UX

3. **Soft Launch** (2 weeks)
   - Enable for 25% of users
   - Monitor error rates
   - Track conversion rates

4. **Full Production** (Ongoing)
   - Enable for all users
   - Set up monitoring alerts
   - Establish SLAs for payment processing

---

## Code Quality & Best Practices

### Testing Strategy

```typescript
// Example test for payment initiation
describe('Payment Service', () => {
  it('should create transaction and stripe payment intent', async () => {
    const params = {
      amount: 50,
      currency: 'USD',
      paymentMethod: 'CREDIT_CARD',
      provider: 'stripe' as const,
      metadata: {
        transactionType: 'donation' as const,
        donorId: 'donor_123',
      },
    };

    const result = await initiatePayment(params);

    expect(result.transactionId).toBeDefined();
    expect(result.clientSecret).toBeDefined();
    expect(result.provider).toBe('stripe');

    // Verify transaction created in database
    const transaction = await db.query.FinancialTransactions.findFirst({
      where: eq(FinancialTransactions.id, result.transactionId),
    });

    expect(transaction).toBeDefined();
    expect(transaction.status).toBe('PENDING');
  });

  it('should handle stripe webhook for successful payment', async () => {
    // Create test transaction
    const transaction = await createTestTransaction();

    // Simulate webhook
    const event = createStripeWebhookEvent({
      type: 'payment_intent.succeeded',
      transactionId: transaction.id,
    });

    await handleStripeWebhook(event);

    // Verify transaction updated
    const updated = await db.query.FinancialTransactions.findFirst({
      where: eq(FinancialTransactions.id, transaction.id),
    });

    expect(updated.status).toBe('COMPLETED');
  });
});
```

### Error Handling

```typescript
// Centralized error types
export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class PaymentProviderError extends PaymentError {
  constructor(message: string, provider: string, public providerError: any) {
    super(message, 'PROVIDER_ERROR', provider);
  }
}

// Usage in service
try {
  const intent = await stripe.paymentIntents.create(params);
} catch (error) {
  if (error instanceof Stripe.errors.StripeError) {
    throw new PaymentProviderError(
      'Failed to create payment intent',
      'stripe',
      error
    );
  }
  throw error;
}
```

### Logging & Monitoring

```typescript
// Use structured logging
logger.info('Payment initiated', {
  transactionId,
  amount,
  currency,
  provider,
  userId,
});

logger.error('Payment failed', {
  transactionId,
  error: error.message,
  stack: error.stack,
  provider,
});

// Recommended metrics to track:
// - Payment success rate by provider
// - Average payment processing time
// - Webhook delivery latency
// - Failed payment reasons
// - Refund rate
```

### Configuration Management

```typescript
// Use feature flags for gradual rollout
const PAYMENT_PROVIDERS = {
  stripe: {
    enabled: process.env.STRIPE_ENABLED === 'true',
    testMode: process.env.NODE_ENV !== 'production',
  },
  flutterwave: {
    enabled: process.env.FLUTTERWAVE_ENABLED === 'true',
    testMode: process.env.NODE_ENV !== 'production',
  },
};

// Validate configuration on startup
if (!PAYMENT_PROVIDERS.stripe.enabled && !PAYMENT_PROVIDERS.flutterwave.enabled) {
  logger.warn('No payment providers enabled');
}
```

---

## Appendices

### Appendix A: Glossary

- **Payment Intent**: Stripe's representation of a payment in progress
- **Webhook**: HTTP callback from payment provider on event occurrence
- **Idempotency**: Ensuring duplicate requests don't cause duplicate effects
- **PCI-DSS**: Payment Card Industry Data Security Standard
- **Mobile Money**: African payment method via mobile phone numbers
- **Class Table Inheritance**: Database pattern where child tables reference parent table

### Appendix B: Useful Resources

#### Stripe
- Documentation: https://stripe.com/docs
- Node.js SDK: https://github.com/stripe/stripe-node
- Testing: https://stripe.com/docs/testing
- Webhooks: https://stripe.com/docs/webhooks

#### Flutterwave
- Documentation: https://developer.flutterwave.com/docs
- Node.js SDK: https://github.com/Flutterwave/Flutterwave-node-v3
- Test credentials: https://developer.flutterwave.com/docs/test-cards

#### Compliance
- PCI-DSS: https://www.pcisecuritystandards.org/
- GDPR: https://gdpr.eu/
- Stripe Compliance: https://stripe.com/docs/security

### Appendix C: Cost Projections

**Scenario: 1000 transactions/month**

| Transaction Type | Avg Amount | Volume | Stripe Cost | Flutterwave Cost |
|------------------|------------|--------|-------------|------------------|
| Donations (card) | $50 | 400 | $580 (2.9% + $0.30) | $760 (3.8%) |
| Dues (card) | $100 | 200 | $610 | $760 |
| Shop (card) | $30 | 200 | $194 | $228 |
| Mobile Money | KES 2000 (~$15) | 200 | N/A | $114 (3.8%) |
| **Total Monthly** | | 1000 | $1,384 | $1,862 |

**Savings with Dual Provider:** ~$478/month by routing mobile money to Flutterwave

### Appendix D: Migration Checklist

**Pre-Launch:**
- [ ] Database migrations run on production
- [ ] Environment variables configured
- [ ] Webhook endpoints registered with providers
- [ ] SSL certificates valid
- [ ] Monitoring dashboards set up
- [ ] Error alerting configured
- [ ] Backup payment provider credentials stored securely
- [ ] Legal terms updated (ToS, Privacy Policy)

**Post-Launch:**
- [ ] Monitor webhook delivery rates (>99% expected)
- [ ] Track payment success rates (>95% expected for cards)
- [ ] Review failed payments daily for patterns
- [ ] Customer support trained on payment issues
- [ ] Escalation path established for payment failures
- [ ] Financial reconciliation process defined

---

## Conclusion

### Summary of Recommendations

1. **Adopt Stripe + Flutterwave** for comprehensive payment coverage
2. **Implement class table inheritance extension** for ShopPurchases
3. **Build robust webhook infrastructure** with event logging and idempotency
4. **Prioritize security** - never handle raw card data
5. **Start with donations and dues** before tackling shop integration
6. **Gradual rollout** with internal testing before production

### Expected Outcomes

✅ **User Experience**
- Seamless payment flows for donations, dues, shop
- Support for cards, bank transfers, and mobile money
- Familiar payment interfaces (Stripe Elements, Flutterwave modal)

✅ **Developer Experience**
- Clean, type-safe integration with TypeScript
- Well-documented APIs
- Easy to add new transaction types

✅ **Business Benefits**
- Increased donation conversion (better UX)
- Lower transaction fees (optimized provider routing)
- Complete audit trail for compliance
- Scalable infrastructure for growth

✅ **Operational Excellence**
- Automated payment processing
- Real-time status updates via webhooks
- Comprehensive error handling and logging
- Easy reconciliation with external systems

### Next Steps

1. **Review this document** with technical team and stakeholders
2. **Validate provider choices** based on target user demographics
3. **Approve budget** for transaction fees
4. **Assign development resources** (estimated 3-4 weeks)
5. **Begin Phase 1** implementation

### Questions to Address

- What percentage of users are in Africa vs. international?
- What is the expected transaction volume in first year?
- Are there specific countries/regions to prioritize?
- What is the budget for transaction fees?
- Do we need to support additional payment methods (crypto, ACH, SEPA)?
- What is the risk tolerance for payment failures?

---

**Document Version:** 1.0  
**Last Updated:** October 26, 2025  
**Author:** GitHub Copilot  
**Status:** Final for Review
