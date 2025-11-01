# Deferred Donor Reconciliation Strategy

**Date:** November 1, 2025  
**Project:** YPF Backend  
**Version:** 2.0  
**Status:** Implemented

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Changes from Previous Strategy](#changes-from-previous-strategy)
3. [New Architecture](#new-architecture)
4. [Implementation Details](#implementation-details)
5. [Benefits](#benefits)
6. [Future Reconciliation Process](#future-reconciliation-process)

---

## Executive Summary

### The New Approach

We have migrated from **immediate donor reconciliation** (matching donors during donation creation) to a **deferred reconciliation** strategy. Guest donor information is now stored directly in the `Donations` table and reconciliation is handled asynchronously through a separate microservice or cron job.

### Key Changes

- Added `guestName` and `guestEmail` nullable columns to the `Donations` table
- Removed immediate call to `findOrCreateConstituent` during donation creation
- Added automatic acknowledgement emails after successful donations
- Reconciliation logic moved to a separate process (to be implemented)

---

## Changes from Previous Strategy

### Previous Approach (Document 0002)

**During donation creation:**
```
Guest provides donation info → findOrCreateConstituent() →
Match by email/phone → Create or find constituent →
Link donation to constituent
```

**Problems with immediate reconciliation:**
- Blocking operation during critical payment flow
- Risk of errors during matching affecting payment success
- Tight coupling between payment and constituent management
- Difficult to adjust matching rules without affecting live donations

### New Approach (Current)

**During donation creation:**
```
Guest provides donation info → Store guestName & guestEmail →
Create donation with guest info → Complete payment
```

**After payment verification:**
```
Payment verified → Send acknowledgement email →
(Later) Reconciliation service processes unmatched donations
```

**Benefits:**
- Non-blocking payment flow
- Separation of concerns
- Easier to refine matching algorithms
- Better error handling and retry logic
- Audit trail of original guest information

---

## New Architecture

### Database Schema Changes

#### Updated `finance.donations` Table

```typescript
{
  id: UUID (PK),
  transactionId: UUID (FK → financial_transactions.id),
  constituentId: UUID? (FK → constituents.id),  // NULL for anonymous or unreconciled
  guestName: TEXT?,      // NEW: Guest's full name
  guestEmail: TEXT?,     // NEW: Guest's email for reconciliation
  projectId: UUID?,
  eventId: UUID?
}
```

**Migration:** `0001_nifty_frightful_four.sql`
```sql
ALTER TABLE "finance"."donations" ADD COLUMN "guest_name" text;
ALTER TABLE "finance"."donations" ADD COLUMN "guest_email" text;
```

### Donation States

A donation can now be in one of three states:

1. **Anonymous Donation**
   - `constituentId = NULL`
   - `guestName = NULL`
   - `guestEmail = NULL`

2. **Authenticated Donation**
   - `constituentId = <user's constituent ID>`
   - `guestName = NULL`
   - `guestEmail = NULL`

3. **Guest Donation (Unreconciled)**
   - `constituentId = NULL`
   - `guestName = "John Doe"`
   - `guestEmail = "john@example.com"`
   - **To be reconciled by background process**

---

## Implementation Details

### 1. Donation Creation (`createDonation`)

**For Authenticated Users:**
```typescript
if (user) {
  constituentId = user.constituentId;
  guestName = null;
  guestEmail = null;
}
```

**For Guest Donors:**
```typescript
else if (donorInfo && !anonymous) {
  constituentId = null;
  guestName = `${donorInfo.firstName} ${donorInfo.lastName}`;
  guestEmail = donorInfo.email || null;
}
```

**For Anonymous Donors:**
```typescript
if (anonymous) {
  constituentId = null;
  guestName = null;
  guestEmail = null;
}
```

### 2. Acknowledgement Emails (`verifyDonation`)

After successful payment verification, the system automatically sends acknowledgement emails:

**For Authenticated Donors:**
```typescript
if (donation.constituentId) {
  // Fetch constituent's email from ContactInformations
  // Send acknowledgement with constituent name
}
```

**For Guest Donors:**
```typescript
else if (donation.guestEmail && donation.guestName) {
  // Send acknowledgement using stored guest info
  await sendDonationAcknowledgementEmail(
    donation.guestEmail,
    donation.guestName,
    amount,
    currency,
    donationId
  );
}
```

### 3. New Email Function

Added to `shared/utils/email.ts`:

```typescript
export async function sendDonationAcknowledgementEmail(
  to: string,
  donorName: string,
  amount: string,
  currency: string,
  donationId: string,
): Promise<void>
```

**Features:**
- Professional branded template
- Donation details and receipt information
- Tax receipt notice
- Reference ID for tracking

---

## Benefits

### 1. **Improved Reliability**
- Payment flow not blocked by constituent matching
- Reduced chance of donation failure due to matching errors
- Better transaction integrity

### 2. **Better Separation of Concerns**
- Payment processing separated from CRM logic
- Easier to maintain and test each component
- Independent scaling of reconciliation service

### 3. **Flexibility**
- Can refine matching algorithms without touching payment code
- Easy to replay reconciliation with different rules
- Can implement manual review for ambiguous matches

### 4. **Audit Trail**
- Original guest information preserved
- Can track when and how reconciliation occurred
- Easier to debug and resolve issues

### 5. **User Experience**
- Faster donation completion
- Immediate acknowledgement emails
- No risk of payment failure due to backend processing

---

## Future Reconciliation Process

### To Be Implemented

A separate microservice or cron job will handle reconciliation:

```typescript
// Pseudo-code for reconciliation service
async function reconcileDonations() {
  // Find unreconciled donations
  const unreconciled = await findDonations({
    constituentId: null,
    guestEmail: { notNull: true }
  });

  for (const donation of unreconciled) {
    // Apply matching logic from donorMatchingService
    const constituent = await findOrCreateConstituent({
      firstName: parseFirstName(donation.guestName),
      lastName: parseLastName(donation.guestName),
      email: donation.guestEmail
    });

    // Update donation with matched constituent
    await updateDonation(donation.id, {
      constituentId: constituent.id
    });

    // Log reconciliation
    await logReconciliation({
      donationId: donation.id,
      constituentId: constituent.id,
      method: 'automatic',
      timestamp: new Date()
    });
  }
}
```

### Reconciliation Strategy

The background process will use the same multi-tiered matching from document 0002:

1. **Email matching** (95% confidence)
2. **Phone matching** (85% confidence - requires storing phone in donations)
3. **Manual review** for ambiguous cases

### Future Enhancements

- Add `guestPhone` field to donations table
- Implement confidence scoring for matches
- Build admin interface for manual reconciliation
- Track reconciliation history
- Set up periodic reconciliation jobs
- Add metrics and monitoring

---

## Migration Checklist

- [x] Update `Donations` schema with `guestName` and `guestEmail`
- [x] Generate database migration
- [x] Remove immediate reconciliation from `createDonation`
- [x] Store guest information in donation records
- [x] Add `sendDonationAcknowledgementEmail` function
- [x] Update `verifyDonation` to send acknowledgement emails
- [ ] Implement reconciliation microservice/cron job
- [ ] Add `guestPhone` field (optional)
- [ ] Build admin reconciliation interface
- [ ] Set up monitoring and metrics

---

## Related Documents

- [0002_donor-unification-strategy.md](./0002_donor-unification-strategy.md) - Original immediate reconciliation approach
- [0003_financial-transaction-api-research.md](./0003_financial-transaction-api-research.md) - Payment processing research

---

## Notes

This implementation provides the foundation for a robust donor management system. The deferred reconciliation approach gives us flexibility to refine matching algorithms and handle edge cases without risking payment failures. The immediate reconciliation logic in `donorMatchingService.ts` remains available for the future reconciliation service to use.
