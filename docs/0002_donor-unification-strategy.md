# Donor Unification Strategy

**Date:** January 30, 2025  
**Project:** YPF Backend  
**Version:** 1.0  
**Status:** Implemented

---

## Overview

This document describes the implemented donor unification strategy for matching returning donors to prevent duplicate constituent records.

## Implementation

The `findOrCreateConstituent` function in `shared/services/donorMatchingService.ts` implements a two-tier matching strategy:

### Tier 1: Email Matching (Primary)

- **Confidence Level**: 95%
- **Process**: Normalizes email to lowercase and checks `ContactInformations` table
- **Match Criteria**: Exact match on normalized email with `contactType = 'EMAIL'`
- If match found, returns existing constituent ID

### Tier 2: Phone Matching (Secondary)

- **Confidence Level**: 85%
- **Process**: Normalizes phone number (removes non-digits, handles Ghana format)
- **Match Criteria**: Exact match on normalized phone with `contactType = 'PHONE'`
- Handles Ghana-specific formats:
  - International: +233 XX XXX XXXX → 233XXXXXXXXX
  - Local: 0XX XXX XXXX → XXXXXXXXX (removes leading 0)
- If match found, returns existing constituent ID

### Tier 3: Create New Constituent

- **Triggers**: No email or phone match found
- **Process**: 
  1. Creates new constituent record with firstName, lastName, salutation
  2. Creates email ContactInformation record (if provided) as primary
  3. Creates phone ContactInformation record (if provided) as primary if no email
- Returns new constituent ID with `matched: false`

## Anonymous Donations

- If `anonymous = true`, returns `null` immediately
- No matching or constituent creation occurs
- Preserves donor privacy

## Return Value

```typescript
interface MatchedConstituent {
  constituentId: string;
  matched: boolean;
  matchMethod?: "email" | "phone" | "new";
}
```

## Benefits

- Prevents duplicate constituent records for returning donors
- Maintains unified donation history per constituent
- Respects privacy for anonymous donations
- Simple, deterministic matching logic
- Handles international and local phone formats
