# Financial Transactions Feature Documentation

## Overview

This document describes the financial transactions feature implementation, including payment verification, webhook handling, and email notifications.

## Architecture

### Key Components

1. **Transaction Verification Endpoint** (`/api/v1/transactions/:reference/verify`)
   - Makes API calls to payment provider (e.g., Paystack) to verify transaction status
   - Updates transaction status in database
   - Sends success email if transaction completed

2. **Webhook Endpoint** (`/api/v1/webhooks/paystack`)
   - Receives payment status updates from payment provider
   - Does NOT make API calls (signature already validated by middleware)
   - Updates transaction status based on webhook payload
   - Sends appropriate email based on status change

3. **Email Notification System**
   - Sends success emails for completed transactions
   - Sends failure emails for failed transactions
   - Sends refund emails for refunded transactions
   - Supports donations, dues payments, and shop orders

4. **Payment Provider Abstraction**
   - Interface-based design for supporting multiple payment gateways
   - Currently supports Paystack
   - Ready for future providers (Stripe, Flutterwave, etc.)

## Flow Diagrams

### Verification Flow (User-Initiated)

```
User -> /verify endpoint
  ↓
Check transaction provider type
  ↓
Call provider-specific verification (e.g., verifyPaystackTransaction)
  ↓
Payment Provider API (Paystack.verifyTransaction)
  ↓
Update transaction status in DB
  ↓
Send success email (if completed)
  ↓
Return status to user
```

### Webhook Flow (Provider-Initiated)

```
Payment Provider -> /webhooks/paystack
  ↓
Verify signature (middleware)
  ↓
handlePaystackWebhook
  ↓
Update transaction status (NO API call)
  ↓
sendTransactionStatusChangeEmail
  ↓
Return 200 OK
```

## Key Design Decisions

### 1. Provider Abstraction

**File:** `shared/services/paymentProviders.ts`

We created an `IPaymentProvider` interface to support multiple payment gateways:

```typescript
export interface IPaymentProvider {
  name: string;
  verifyTransaction(reference: string): Promise<VerifyTransactionResult>;
  mapStatus(providerStatus: string): string;
  mapPaymentMethod(providerChannel: string): string;
}
```

**Benefits:**

- Easy to add new payment providers
- Consistent API across providers
- Centralized status and payment method mapping

**To add a new provider:**

1. Create a new class implementing `IPaymentProvider`
2. Add it to the `getPaymentProvider()` factory function
3. Add a case in `verifyTransaction()` switch statement

### 2. Separation of Verification and Webhook

**Verification Endpoint:**

- ALWAYS makes API call to payment provider
- Used when user wants to manually check status
- Race condition protection (only updates PENDING transactions)

**Webhook Endpoint:**

- NEVER makes API call (already validated by signature)
- Used for real-time status updates from provider
- More efficient and immediate

### 3. Email System

**File:** `shared/utils/email.ts`

Email templates for all scenarios:

- `sendDonationAcknowledgementEmail` - For donations
- `sendDuesPaymentAcknowledgementEmail` - For dues payments
- `sendOrderConfirmationEmail` - For shop orders
- `sendTransactionFailureEmail` - For failed payments
- `sendTransactionRefundEmail` - For refunded payments

**Email Retrieval:**

- Uses `ContactInformations` table (not Users table)
- Prioritizes primary email addresses
- Supports guest donations with email

### 4. Transaction Types

The system supports three transaction types:

1. **Donations** (`finance.donations`)
   - Can be from registered users or guests
   - Can be for projects or events
   - Guest donations use `guestEmail` and `guestName`

2. **Dues Payments** (`finance.dues_payments`)
   - For member dues
   - Linked to specific dues period
   - Always from registered members

3. **Shop Orders** (`shop.order_payments`)
   - For merchandise purchases
   - Always from registered users
   - Linked to specific order

## API Reference

### Verify Transaction

**Endpoint:** `POST /api/v1/transactions/:reference/verify`

**Description:** Manually verify a transaction with the payment provider.

**Parameters:**

- `reference` (path) - Transaction reference ID

**Response:**

```json
{
  "success": true,
  "message": "Transaction verified successfully",
  "data": {
    "status": "COMPLETED"
  }
}
```

### Paystack Webhook

**Endpoint:** `POST /api/v1/webhooks/paystack`

**Description:** Receive payment status updates from Paystack.

**Headers:**

- `x-paystack-signature` - Webhook signature (validated by middleware)

**Body:**

```json
{
  "event": "charge.success",
  "data": {
    "reference": "ref_123",
    "status": "success",
    "amount": "10000",
    "currency": "GHS",
    "channel": "card"
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Webhook processed",
  "data": null
}
```

## Database Schema

### FinancialTransactions Table

```sql
finance.financial_transactions
- id (uuid)
- amount (decimal)
- currency (varchar)
- transaction_date (timestamp)
- payment_method (enum: CREDIT_CARD, BANK_TRANSFER, MOBILE_MONEY, CASH)
- status (enum: PENDING, COMPLETED, FAILED, REFUNDED)
- external_provider (enum: PAYSTACK)
- external_ref (text, unique)
```

## Future Enhancements

### Adding a New Payment Provider (e.g., Stripe)

1. **Create Provider Class** (`shared/services/paymentProviders.ts`):

```typescript
export class StripeProvider implements IPaymentProvider {
  name = "STRIPE";
  private secretKey: string;

  constructor() {
    this.secretKey = variables.services.stripe.secretKey;
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    // Implement Stripe verification logic
  }

  mapStatus(providerStatus: string): string {
    // Map Stripe status to internal status
  }

  mapPaymentMethod(providerChannel: string): string {
    // Map Stripe payment method to internal method
  }
}
```

2. **Add to Factory** (`shared/services/paymentProviders.ts`):

```typescript
export function getPaymentProvider(
  providerName: string,
): IPaymentProvider | null {
  switch (providerName.toUpperCase()) {
    case "PAYSTACK":
      return new PaystackProvider();
    case "STRIPE":
      return new StripeProvider();
    default:
      return null;
  }
}
```

3. **Add Provider-Specific Verification** (`shared/services/transactionsService.ts`):

```typescript
export async function verifyStripeTransaction(reference: string): Promise<...> {
  // Similar to verifyPaystackTransaction but for Stripe
}

export async function verifyTransaction(reference: string): Promise<...> {
  // ...
  switch (transaction.externalProvider) {
    case "PAYSTACK":
      return await verifyPaystackTransaction(reference);
    case "STRIPE":
      return await verifyStripeTransaction(reference);
    // ...
  }
}
```

4. **Add Webhook Handler** (`features/api/v1/webhooks/`):

```typescript
export async function handleStripeWebhook(payload: StripeWebhookPayload): Promise<...> {
  // Similar to handlePaystackWebhook but for Stripe
}
```

5. **Update Schema** (if needed):

```typescript
export const ExternalProviderEnum = finance.enum("external_provider", [
  "PAYSTACK",
  "STRIPE", // Add new provider
]);
```

## Error Handling

- All functions use try-catch blocks
- Errors are logged using the centralized logger
- Email failures don't break payment flow (logged only)
- Race conditions handled by checking transaction status before update

## Testing

For manual testing:

1. **Test Verification Endpoint:**
   - Create a pending transaction in the database
   - Call `/api/v1/transactions/{reference}/verify`
   - Check that status is updated
   - Check that email is sent

2. **Test Webhook:**
   - Use Paystack webhook testing tool
   - Send test webhook to `/api/v1/webhooks/paystack`
   - Check that status is updated
   - Check that appropriate email is sent

3. **Test Email System:**
   - Ensure SMTP configuration is correct
   - Test all email templates (success, failure, refund)
   - Verify email content and formatting

## Security Considerations

1. **Webhook Signature Verification:**
   - All webhooks validated by `verifyPaystackSignature` middleware
   - Invalid signatures rejected with 400 status

2. **Race Condition Protection:**
   - Transactions only updated if still in PENDING status
   - Prevents duplicate processing

3. **Email Privacy:**
   - Guest emails only sent if explicitly provided
   - Uses ContactInformations table for registered users
   - No email sent if recipient info not available

## Troubleshooting

### Email Not Sent

1. Check SMTP configuration in environment variables
2. Check logs for email sending errors
3. Verify recipient has email in ContactInformations table
4. For guests, verify `guestEmail` and `guestName` are set

### Transaction Not Updated

1. Check transaction exists with the given reference
2. Verify transaction is in PENDING status
3. Check payment provider API credentials
4. Review logs for specific error messages

### Webhook Not Working

1. Verify webhook URL is publicly accessible
2. Check webhook signature validation
3. Ensure correct secret key in environment variables
4. Review Paystack dashboard for webhook delivery status
