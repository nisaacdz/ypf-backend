# Transaction Verification API

## Overview

The new transaction verification system provides a centralized, provider-agnostic way to verify payments with built-in race condition protection.

## Endpoint

### Verify Transaction

**POST** `/api/v1/transactions/:reference/verify`

Verifies a transaction using its external reference (e.g., Paystack reference).

#### Parameters

- `reference` (path parameter): The external transaction reference from the payment provider

#### Response

```json
{
  "success": true,
  "message": "Transaction verified successfully",
  "data": {
    "status": "COMPLETED" | "PENDING" | "FAILED" | "REFUNDED"
  }
}
```

#### Example Usage

```javascript
// After receiving payment success callback from Paystack SDK
const paystackReference = "ref_123456789";

fetch(`/api/v1/transactions/${paystackReference}/verify`, {
  method: "POST",
})
  .then((res) => res.json())
  .then((data) => {
    if (data.success && data.data.status === "COMPLETED") {
      // Payment confirmed, show success message
      console.log("Payment successful!");
    }
  });
```

## Race Condition Protection

The system is designed to handle race conditions between webhooks and manual verification:

1. **First Check**: Before calling the payment provider, the system checks if the transaction is already `COMPLETED`
2. **Atomic Update**: Updates use `WHERE status = PENDING` to ensure only one process succeeds
3. **Email Deduplication**: Emails are only sent by the process that successfully updates the transaction

### Example Scenario

```
Timeline:
- User clicks "Verify Payment" → Manual verification starts
- Webhook arrives simultaneously → Webhook verification starts
- Both processes call verifyPaystackTransaction()

Process 1 (whichever finishes first):
- Calls Paystack API
- Updates transaction: PENDING → COMPLETED ✅
- Sends confirmation email ✅

Process 2 (whichever finishes second):
- Calls Paystack API (or returns early if already COMPLETED)
- Tries to update: PENDING → COMPLETED ❌ (no rows affected)
- Does NOT send email ❌
```

## Migration from Old Endpoint

### Old Endpoint (Deprecated)

```
PATCH /api/v1/donations/:donationId/verify
```

This endpoint was specific to donations and required the donation ID.

### New Endpoint (Recommended)

```
POST /api/v1/transactions/:reference/verify
```

This endpoint is provider-agnostic and works with any transaction type using the external reference.

### Migration Guide

**Before:**
```javascript
// Old approach - required donation ID
const donationId = "123e4567-e89b-12d3-a456-426614174000";
await fetch(`/api/v1/donations/${donationId}/verify`, {
  method: "PATCH",
});
```

**After:**
```javascript
// New approach - use payment reference
const paystackReference = "ref_123456789";
await fetch(`/api/v1/transactions/${paystackReference}/verify`, {
  method: "POST",
});
```

## Webhook Integration

The webhook handler (`/api/v1/webhooks/paystack`) now uses the same verification logic:

```javascript
// Webhook handler automatically:
// 1. Extracts reference from webhook payload
// 2. Calls verifyPaystackTransaction(reference)
// 3. Sends email only if transaction was just updated
// 4. Handles race conditions transparently
```

## Email Notifications

Emails are sent automatically when:
- Transaction status changes from `PENDING` to `COMPLETED`
- The process is the first one to update the transaction (wasUpdated = true)
- Recipient information is available (guest email or registered user)

Email types supported:
- **Donation receipts**: Sent to donors with amount and reference
- **Future types**: Shop orders, event tickets, membership dues (planned)

## Database Schema

### FinancialTransactions Table

```sql
- id: UUID (Primary Key)
- amount: DECIMAL(10,2)
- currency: VARCHAR(3)
- status: ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')
- externalProvider: ENUM('PAYSTACK')
- externalRef: TEXT (UNIQUE) -- Used for verification
- transactionDate: TIMESTAMP
- paymentMethod: ENUM('CREDIT_CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CASH')
```

## Error Handling

### Common Errors

1. **404 Not Found**
   ```json
   {
     "success": false,
     "message": "Transaction not found"
   }
   ```
   - The reference doesn't exist in the database

2. **500 Server Error**
   ```json
   {
     "success": false,
     "message": "Failed to verify payment"
   }
   ```
   - Payment provider API call failed
   - Database connection issue

### Best Practices

1. **Always use the reference from payment provider**: Don't generate your own
2. **Handle 404 gracefully**: Transaction might not be created yet
3. **Retry on 500**: Temporary issues may resolve
4. **Don't rely solely on manual verification**: Webhooks are more reliable
5. **Check transaction status before showing UI**: Use `/donations/:id/check` endpoint

## Testing

See `/tests/integration/transactionsRoutes.ts` for comprehensive test examples including:
- Basic verification flow
- Race condition handling
- Duplicate verification attempts
- Error scenarios
