# Donor Reconciliation Strategy

**Date:** November 8, 2025  
**Project:** YPF Backend  
**Status:** Planned - Not Yet Implemented

---

## Overview

This document outlines the planned donor reconciliation strategy for the YPF Backend. The system currently stores guest donor information in the `Donations` table (`guestName` and `guestEmail` fields) but does not automatically reconcile them with existing constituents.

---

## Current State

### Guest Donation Storage

When a guest (non-authenticated user) makes a donation, the system stores:

```typescript
{
  constituentId: null,            // Not linked to any constituent yet
  guestName: "John Doe",          // Full name provided by guest
  guestEmail: "john@example.com", // Email provided by guest
  acknowledgementSent: true,      // Email sent flag
}
```

### Deferred Reconciliation Approach

The current implementation uses a **deferred reconciliation** strategy:

1. **During Donation**: Store guest information without matching
2. **After Payment**: Send acknowledgement email to guest
3. **Later**: Reconciliation service processes unreconciled donations

**Benefits:**

- Non-blocking payment flow
- Separation of concerns
- Flexibility to refine matching algorithms
- Better error handling

---

## Planned Implementation

### Reconciliation Service

**Status:** To Be Implemented

A background service (microservice or cron job) will:

1. Find donations with `constituentId = NULL` and `guestEmail IS NOT NULL`
2. Apply matching logic to find or create constituents
3. Update donations with matched `constituentId`
4. Log reconciliation actions for audit

### Matching Strategy

**Proposed Tiers:**

1. **Email Matching** (95% confidence)
   - Case-insensitive email comparison
   - Primary matching method

2. **Phone Matching** (85% confidence)
   - Normalized phone number comparison
   - Secondary matching method
   - Requires adding `guestPhone` field to donations

3. **Manual Review** (for ambiguous cases)
   - Admin interface for conflict resolution
   - Manual merge/split capabilities

### Future Enhancements

- **Phone Number Field**: Add `guestPhone` to `Donations` table
- **Reconciliation History**: Track when and how reconciliation occurred
- **Confidence Scoring**: Assign confidence levels to matches
- **Admin Interface**: Build UI for manual reconciliation
- **Metrics & Monitoring**: Track reconciliation success rates

---

## Database Schema Changes Needed

```sql
-- Add phone number field to donations table
ALTER TABLE finance.donations
ADD COLUMN guest_phone TEXT;

-- Create reconciliation log table
CREATE TABLE finance.donor_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES finance.donations(id),
  constituent_id UUID NOT NULL REFERENCES core.constituents(id),
  match_method VARCHAR(50) NOT NULL, -- 'email', 'phone', 'manual'
  confidence_score INTEGER, -- 0-100
  reconciled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reconciled_by UUID REFERENCES app.users(id), -- NULL for automatic
  notes TEXT
);
```

---

## Implementation Timeline

- **Phase 1**: Database schema updates (not yet scheduled)
- **Phase 2**: Reconciliation service development (not yet scheduled)
- **Phase 3**: Admin interface (not yet scheduled)
- **Phase 4**: Monitoring and analytics (not yet scheduled)

---

## Related Documentation

- See **0002_financial-transactions.md** for donation flow details
- Current implementation uses deferred reconciliation approach
- Guest information is preserved for future processing

---

**Note:** This is a placeholder document. The donor reconciliation feature has not yet been fully designed or implemented. The strategy will be refined based on business requirements and data analysis.

---

**Document Version:** 0.1  
**Last Updated:** November 8, 2025  
**Status:** Planning Phase
