# Donor Unification Strategy

**Date:** January 30, 2025  
**Project:** YPF Backend  
**Version:** 1.0  
**Status:** Proposal

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Current Architecture Analysis](#current-architecture-analysis)
4. [Industry Best Practices](#industry-best-practices)
5. [Proposed Unification Strategy](#proposed-unification-strategy)
6. [Implementation Approach](#implementation-approach)
7. [Technical Specification](#technical-specification)
8. [Security & Privacy Considerations](#security--privacy-considerations)
9. [Edge Cases & Risk Mitigation](#edge-cases--risk-mitigation)
10. [Testing Strategy](#testing-strategy)
11. [Future Enhancements](#future-enhancements)
12. [Appendices](#appendices)

---

## Executive Summary

### The Challenge

When unauthenticated visitors make donations without selecting the **anonymous** option, the system creates new `constituent` and `donor` records for each donation. This leads to:

- **Duplicate donor profiles** for returning donors
- **Fragmented donation history** across multiple records
- **Inaccurate donor analytics** and reporting
- **Poor user experience** when donors later create accounts

### The Solution

Implement a **multi-tiered matching strategy** that identifies returning donors by:

1. **Email address** (primary identifier)
2. **Phone number** (secondary identifier)
3. **Name + contact combination** (fuzzy matching for data quality issues)

This strategy balances **donor convenience** with **high confidence matching** while respecting privacy choices (anonymous donations remain unlinked).

### Expected Outcomes

✅ **Reduced duplicate records** by ~70-85% for returning donors  
✅ **Unified donation history** accessible when donors create accounts  
✅ **Improved donor analytics** for fundraising insights  
✅ **Better user experience** with seamless account linking  
✅ **Maintained privacy** for anonymous donations

---

## Problem Statement

### Current Behavior

**Scenario 1: Guest Donation (Non-Anonymous)**

```
User donates as guest → Provides name, email, phone
↓
System creates:
  - New Constituent record
  - New Donor record
  - New ContactInformation records
  - Donation record (linked to donor_id)
```

**Scenario 2: Returning Guest Donor**

```
Same user donates again as guest → Provides same/similar info
↓
System creates:
  - ANOTHER Constituent record (duplicate)
  - ANOTHER Donor record (duplicate)
  - ANOTHER ContactInformation records
  - New Donation record (linked to new donor_id)
```

**Result:** User's donation history is split across multiple records.

**Scenario 3: Guest Donor Creates Account Later**

```
User creates account → Uses email from previous donation
↓
System creates:
  - New Constituent (third one!)
  - New User record
  - Links User to new Constituent
↓
Previous donations still linked to old Constituent/Donor records
```

**Result:** User cannot see their donation history in their account.

### Why This Matters

1. **Donor Relations**: Cannot track donor lifetime value or donation frequency accurately
2. **Reporting**: Overstates number of unique donors
3. **User Experience**: Donors frustrated by fragmented history when they create accounts
4. **Data Quality**: Database grows with duplicate records
5. **Communication**: May send duplicate thank-you emails or campaigns

---

## Current Architecture Analysis

### Database Schema

#### Core Tables

**1. `core.constituents`**

```typescript
{
  id: UUID (PK),
  firstName: TEXT,
  lastName: TEXT,
  preferredName: TEXT?,
  dateOfBirth: DATE?,
  gender: ENUM?,
  // ... other fields
}
```

**Purpose**: Universal person record. One constituent can have multiple roles (donor, member, volunteer, etc.)

**2. `core.donors`**

```typescript
{
  id: UUID (PK),
  constituentId: UUID (FK → constituents.id, UNIQUE)
}
```

**Relationship**: One-to-one with constituents. If a constituent donates, they get a donor record.

**3. `core.contact_informations`**

```typescript
{
  id: SERIAL (PK),
  constituentId: UUID (FK → constituents.id),
  contactType: ENUM('EMAIL', 'PHONE', 'WHATSAPP'),
  value: TEXT,
  isPrimary: BOOLEAN,
  UNIQUE(constituentId, contactType, value)
}
```

**Purpose**: Store multiple contact points per constituent. Email and phone are key for matching.

**4. `app.users`**

```typescript
{
  id: UUID (PK),
  email: VARCHAR(255) UNIQUE,
  password: TEXT?,
  constituentId: UUID (FK → constituents.id, UNIQUE),
  // OAuth fields (googleId, appleId, facebookId)
}
```

**Relationship**: One-to-one with constituents. Authenticated users are linked to a constituent.

**5. `finance.donations`**

```typescript
{
  id: UUID (PK),
  transactionId: UUID (FK → financial_transactions.id),
  donorId: UUID? (FK → donors.id), // NULL for anonymous donations
  projectId: UUID?,
  eventId: UUID?
}
```

**Anonymous Donations**: `donorId` is NULL, no constituent/donor record needed.

**6. `app.otps`**

```typescript
{
  id: SERIAL (PK),
  email: VARCHAR(255),
  code: TEXT,
  payload: JSONB?, // Can store additional data
  expiresAt: TIMESTAMP,
  usedAt: TIMESTAMP?
}
```

**Purpose**: Used for password resets and potentially donation confirmation flows.

### Current Flows

#### Authenticated User Donation

```typescript
// User is logged in (has req.User from authenticate middleware)
const constituentId = req.User.constituentId;

// Find or create donor profile
const donor = await findOrCreateDonor(constituentId);

// Create donation
await createDonation({
  donorId: donor.id,
  amount: 50,
  // ...
});
```

✅ **Works well**: Donation correctly linked to existing constituent.

#### Guest Donation (Current - Problematic)

```typescript
// User is NOT logged in
// Donation form collects: firstName, lastName, email, phone

// Always creates new records (problem!)
const constituent = await createConstituent({
  firstName: "John",
  lastName: "Doe",
});

await createContactInformation({
  constituentId: constituent.id,
  contactType: "EMAIL",
  value: "john.doe@example.com",
});

const donor = await createDonor({
  constituentId: constituent.id,
});

await createDonation({
  donorId: donor.id,
  // ...
});
```

❌ **Problem**: No check for existing constituent with same email/phone.

---

## Industry Best Practices

### Research: How Do Major Platforms Handle This?

#### 1. Stripe Customers

**Strategy**: Use email as unique identifier

```javascript
// Stripe checks for existing customer by email
const customer = await stripe.customers.list({
  email: "donor@example.com",
  limit: 1,
});

if (customer.data.length > 0) {
  // Use existing customer
  customerId = customer.data[0].id;
} else {
  // Create new customer
  const newCustomer = await stripe.customers.create({
    email: "donor@example.com",
    name: "John Doe",
  });
  customerId = newCustomer.id;
}
```

**Takeaway**: Email is primary unique identifier.

#### 2. PayPal

**Strategy**: Email-based account linking

- If email exists, prompts user to log in to PayPal
- If new email, creates guest checkout
- Guests can later "claim" their transactions by creating account with same email

**Takeaway**: Post-registration linking supported.

#### 3. Shopify

**Strategy**: Customer profiles linked by email

- Checkout creates/finds customer by email
- Multiple orders consolidated under one customer
- Phone number used as secondary identifier
- Name variations tolerated (fuzzy matching)

**Takeaway**: Multi-field matching with email as anchor.

#### 4. GoFundMe

**Strategy**: Email-based donor tracking

- Email is required for non-anonymous donations
- Creates donor profile if doesn't exist
- Later account creation auto-links previous donations
- Anonymous donations have no profile

**Takeaway**: Email-based with explicit anonymous option.

#### 5. DonorBox (Nonprofit Platform)

**Strategy**: Constituent matching rules

- Email match (highest confidence)
- Email + name match
- Phone + name match
- Admin tools to merge duplicate profiles
- Privacy-first: anonymous donations stay anonymous

**Takeaway**: Tiered matching with manual merge capability.

### Common Patterns

1. **Email is Primary**: Almost universal use of email as unique identifier
2. **Case Insensitivity**: Emails compared case-insensitively
3. **Phone Number Normalization**: Strip formatting, compare digits only
4. **Anonymous Respect**: Never attempt to de-anonymize
5. **Post-Registration Linking**: Allow users to claim past actions
6. **Fuzzy Name Matching**: Handle typos, nicknames, initials
7. **Manual Merge Tools**: Admin interface to resolve edge cases

---

## Proposed Unification Strategy

### Core Principles

1. **Email is Primary Identifier** (highest confidence)
2. **Phone Number is Secondary** (high confidence)
3. **Name + Contact is Tertiary** (medium confidence, requires validation)
4. **Anonymous Donations are Sacred** (never match/link)
5. **User Consent Implicit** (by providing contact info, user accepts linking)
6. **Data Quality Matters** (normalize inputs before matching)
7. **Reversible Actions** (admin tools to split incorrectly merged records)

### Matching Algorithm (Tiered Approach)

#### Tier 1: Exact Email Match (Highest Confidence)

```typescript
/**
 * Find existing constituent by email (case-insensitive)
 */
async function findConstituentByEmail(
  email: string,
): Promise<Constituent | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const result = await db.query.ContactInformations.findFirst({
    where: and(
      eq(ContactInformations.contactType, "EMAIL"),
      sql`LOWER(${ContactInformations.value}) = ${normalizedEmail}`,
    ),
    with: {
      constituent: true,
    },
  });

  return result?.constituent || null;
}
```

**Confidence Level**: 95%+  
**Reasoning**: Email addresses are unique, rarely shared, and self-verified by user receiving confirmation emails.

#### Tier 2: Exact Phone Match (High Confidence)

```typescript
/**
 * Find existing constituent by phone (normalized)
 */
async function findConstituentByPhone(
  phone: string,
): Promise<Constituent | null> {
  const normalizedPhone = normalizePhoneNumber(phone);

  const result = await db.query.ContactInformations.findFirst({
    where: and(
      eq(ContactInformations.contactType, "PHONE"),
      sql`${ContactInformations.value} = ${normalizedPhone}`,
    ),
    with: {
      constituent: true,
    },
  });

  return result?.constituent || null;
}

/**
 * Normalize phone number (strip non-digits, handle country codes)
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, "");

  // Handle common country code patterns
  // e.g., +1 (USA), +254 (Kenya), +234 (Nigeria)
  if (digits.length > 10) {
    // Keep country code + local number
    return digits;
  }

  return digits;
}
```

**Confidence Level**: 85%+  
**Reasoning**: Phone numbers are personal but can be shared (family) or recycled over time.

#### Tier 3: Name + Contact Combination (Medium Confidence)

```typescript
/**
 * Find constituent by name + email/phone combination
 * Used when exact contact match fails but name is similar
 */
async function findConstituentByNameAndContact(
  firstName: string,
  lastName: string,
  email?: string,
  phone?: string,
): Promise<Constituent | null> {
  // Normalize name for comparison
  const normFirstName = normalizeName(firstName);
  const normLastName = normalizeName(lastName);

  // Build search query
  let query = db
    .select()
    .from(Constituents)
    .where(
      and(
        sql`LOWER(${Constituents.firstName}) = ${normFirstName}`,
        sql`LOWER(${Constituents.lastName}) = ${normLastName}`,
      ),
    );

  const candidates = await query;

  // If multiple matches, check contact info to disambiguate
  if (candidates.length > 1 && (email || phone)) {
    for (const candidate of candidates) {
      const contacts = await db.query.ContactInformations.findMany({
        where: eq(ContactInformations.constituentId, candidate.id),
      });

      const hasMatchingContact = contacts.some(
        (c) =>
          (email &&
            c.contactType === "EMAIL" &&
            c.value.toLowerCase() === email.toLowerCase()) ||
          (phone &&
            c.contactType === "PHONE" &&
            normalizePhoneNumber(c.value) === normalizePhoneNumber(phone)),
      );

      if (hasMatchingContact) {
        return candidate;
      }
    }
  }

  return candidates[0] || null;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}
```

**Confidence Level**: 60-70%  
**Reasoning**: Names can have typos, nicknames, or cultural variations. Use cautiously.

### Decision Flow

```
Guest Donation Submitted
├─ Is "anonymous" flag set?
│  ├─ YES → Create donation with donorId=NULL (STOP)
│  └─ NO → Continue matching
│
├─ Email provided?
│  ├─ YES → Check Tier 1 (Email Match)
│  │  ├─ FOUND → Use existing constituent
│  │  └─ NOT FOUND → Continue to Tier 2
│  └─ NO → Continue to Tier 2
│
├─ Phone provided?
│  ├─ YES → Check Tier 2 (Phone Match)
│  │  ├─ FOUND → Use existing constituent
│  │  └─ NOT FOUND → Continue to Tier 3
│  └─ NO → Continue to Tier 3
│
├─ Name + (Email OR Phone) provided?
│  ├─ YES → Check Tier 3 (Name + Contact Match)
│  │  ├─ FOUND → Use existing constituent (with caution flag)
│  │  └─ NOT FOUND → Create new constituent
│  └─ NO → Create new constituent
```

### Recommended Approach (Conservative)

**Use Tier 1 (Email) and Tier 2 (Phone) only in production initially.**

- **Tier 1**: Very high confidence, safe to auto-match
- **Tier 2**: High confidence, safe for most cases
- **Tier 3**: Requires more testing, consider admin review for now

---

## Implementation Approach

This section outlines the key service and logic needed for donor matching. Full implementation details including API changes, database updates, and account linking follow in subsequent sections.

### Core Matching Service

The core matching logic should be implemented as a dedicated service:

```typescript
// shared/services/donorMatchingService.ts

import { db } from "@/configs/db";
import { Constituents, ContactInformations, Donors } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export interface DonorMatchingInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isAnonymous?: boolean;
}

export interface DonorMatchingResult {
  matched: boolean;
  constituentId?: string;
  donorId?: string;
  matchMethod?: "email" | "phone" | "new";
  confidence?: number;
}

/**
 * Main entry point for donor matching logic.
 * Returns existing constituent/donor if match found, or indicates new record needed.
 */
export async function findOrCreateDonorForGuest(
  input: DonorMatchingInput,
): Promise<DonorMatchingResult> {
  // Anonymous donations: no matching needed
  if (input.isAnonymous) {
    return { matched: false };
  }

  // Tier 1: Email matching (highest priority)
  if (input.email) {
    const constituent = await findConstituentByEmail(input.email);
    if (constituent) {
      const donor = await findOrCreateDonorForConstituent(constituent.id);
      return {
        matched: true,
        constituentId: constituent.id,
        donorId: donor.id,
        matchMethod: "email",
        confidence: 95,
      };
    }
  }

  // Tier 2: Phone matching (secondary)
  if (input.phone) {
    const constituent = await findConstituentByPhone(input.phone);
    if (constituent) {
      // Found by phone - add email if provided and not already present
      if (input.email) {
        await addContactIfNotExists(constituent.id, "EMAIL", input.email);
      }

      const donor = await findOrCreateDonorForConstituent(constituent.id);
      return {
        matched: true,
        constituentId: constituent.id,
        donorId: donor.id,
        matchMethod: "phone",
        confidence: 85,
      };
    }
  }

  // No match found - need to create new constituent/donor
  return { matched: false };
}
```

**Key Functions:**

1. `findConstituentByEmail()` - Case-insensitive email lookup
2. `findConstituentByPhone()` - Normalized phone lookup
3. `findOrCreateDonorForConstituent()` - Ensures donor profile exists
4. `addContactIfNotExists()` - Enriches constituent with new contact info
5. `createNewDonorConstituent()` - Creates complete new donor record

---

## Technical Specification

### API Changes

#### New Endpoint: Guest Donation

```typescript
POST /api/v1/donations/guest

Request Body:
{
  "amount": 50.00,
  "currency": "USD",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "isAnonymous": false,
  "projectId": "uuid-of-project",
  "paymentMethod": "CREDIT_CARD"
}

Response:
{
  "success": true,
  "data": {
    "donationId": "uuid",
    "transactionId": "uuid",
    "matched": true,
    "matchMethod": "email"
  },
  "message": "Donation received successfully"
}
```

#### Updated Response: Registration

```typescript
POST /api/v1/auth/register

Response includes linked donations count:
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "john.doe@example.com",
    "linkedDonations": 3
  },
  "message": "Account created and 3 past donations linked"
}
```

### Database Changes

**Recommendation**: No schema changes required initially. All matching logic can be implemented in the application layer using existing tables.

**Optional Future Enhancement**: Add metadata table to track matching decisions for audit purposes.

### Integration Points

1. **Donation Creation**: Update to use `findOrCreateDonorForGuest()`
2. **User Registration**: Add `linkPastDonationsToUser()` call
3. **Contact Updates**: Normalize before storing
4. **Admin Tools**: Provide duplicate detection and merge utilities

---

## Security & Privacy Considerations

### 1. Anonymous Donations

**Rule**: Never attempt to match anonymous donations.

```typescript
if (isAnonymous) {
  // Create donation with donorId = NULL
  // Do NOT create constituent/donor records
  // Do NOT look up by email/phone
  return { donorId: null };
}
```

**Reasoning**: User explicitly chose anonymity. Respect that choice.

### 2. Email Privacy

**Concerns:**

- Email addresses are PII (Personally Identifiable Information)
- Users may not expect donations to be linked
- GDPR/CCPA compliance requirements

**Mitigations:**

- **Transparent Communication**: Privacy policy states donations with same email are linked
- **User Control**: Allow users to unlink donations in account settings
- **Data Minimization**: Only store necessary contact info
- **Right to Delete**: Honor deletion requests (soft delete)

### 3. Phone Number Privacy

**Concerns:**

- Phone numbers can be reassigned (recycled)
- Families may share phone numbers
- International formatting complexity

**Mitigations:**

- **Lower Confidence**: Phone matching has 85% confidence (vs 95% email)
- **Normalization**: Strip formatting before comparison
- **Verification**: Consider SMS OTP for high-value donations
- **Time Windowing**: Only match phone numbers used in last 2 years

### 4. False Positive Matches

**Risk**: Matching wrong constituent (e.g., shared email, typo)

**Mitigations:**

- **High Confidence Threshold**: Only auto-match at 85%+ confidence
- **Notification**: Email confirmation when match occurs
- **User Review**: Allow users to contest matches
- **Admin Override**: Tools to split incorrectly merged records

### 5. GDPR Compliance

**Requirements:**

- Right to access: Users can see all linked donations
- Right to rectification: Users can update contact info
- Right to erasure: Soft delete with donation history anonymized
- Consent: Privacy policy disclosure

**Implementation:**

```typescript
// API to let user see linked donations
GET /api/v1/donors/me/donations

// API to unlink a specific donation (if wrong match)
DELETE /api/v1/donors/me/donations/:donationId/unlink
```

---

## Edge Cases & Risk Mitigation

### Edge Case 1: Shared Email (Family)

**Scenario**: Husband and wife donate separately using shared family email.

**Current Behavior**: Both donations linked to first person who used email.

**Mitigation:**

- Use name + email combination for disambiguation
- Allow admin to split into separate constituents
- Suggest users use individual emails

### Edge Case 2: Typo in Email

**Scenario**: User types `john.doe@gmai.com` instead of `john.doe@gmail.com`.

**Current Behavior**: Creates new constituent (wrong email doesn't match).

**Mitigation:**

- Email validation on frontend (check MX records)
- Fuzzy email matching (advanced, not recommended initially)
- Send confirmation email (user will notice wrong address)

### Edge Case 3: Phone Number Recycling

**Scenario**: Phone number was reassigned to new person.

**Current Behavior**: Donations incorrectly linked to new phone owner.

**Mitigation:**

- Lower confidence for phone-only matching (85%)
- Time window: Only match phones used in last 2 years
- Prefer email over phone when both available

### Edge Case 4: User Creates Multiple Accounts

**Scenario**: User forgets they have account, creates new one with different email.

**Current Behavior**: Two separate constituent records exist.

**Mitigation:**

- Admin duplicate detection tool
- Allow user to request account merge
- Fuzzy name matching to suggest duplicates during registration

### Edge Case 5: Donation Before Account Creation

**Scenario**: User donates as guest, then creates account months later.

**Current Behavior**: With Phase 2 implementation, donations automatically linked.

**Risk**: User may not remember donating, sees unexpected history.

**Mitigation:**

- Show notification during registration: "We found X previous donations"
- Allow user to contest/unlink if incorrect
- Privacy policy disclosure about linking behavior

### Edge Case 6: International Characters in Names

**Scenario**: User enters name with accents (José, François).

**Current Behavior**: Exact match required, may fail if encoding differs.

**Mitigation:**

- Unicode normalization (NFD vs NFC)
- Consider ASCII transliteration for matching (lose accents)
- Store original form, match on normalized form

---

## Testing Strategy

### Unit Tests

```typescript
describe("Donor Matching Service", () => {
  describe("findConstituentByEmail", () => {
    it("should match email case-insensitively", async () => {
      await createTestConstituent({
        email: "John.Doe@Example.com",
      });

      const result = await findConstituentByEmail("john.doe@example.com");
      expect(result).not.toBeNull();
    });

    it("should handle email with extra spaces", async () => {
      await createTestConstituent({
        email: "test@example.com",
      });

      const result = await findConstituentByEmail("  test@example.com  ");
      expect(result).not.toBeNull();
    });
  });

  describe("findConstituentByPhone", () => {
    it("should normalize phone numbers before matching", async () => {
      await createTestConstituent({
        phone: "1234567890",
      });

      const result1 = await findConstituentByPhone("(123) 456-7890");
      const result2 = await findConstituentByPhone("+1-123-456-7890");

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1.id).toBe(result2.id);
    });
  });

  describe("findOrCreateDonorForGuest", () => {
    it("should return existing donor when email matches", async () => {
      const existing = await createTestConstituent({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      const result = await findOrCreateDonorForGuest({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      expect(result.matched).toBe(true);
      expect(result.constituentId).toBe(existing.id);
      expect(result.matchMethod).toBe("email");
    });

    it("should not match anonymous donations", async () => {
      await createTestConstituent({
        email: "john@example.com",
      });

      const result = await findOrCreateDonorForGuest({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        isAnonymous: true,
      });

      expect(result.matched).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
describe("Guest Donation Flow", () => {
  it("should create new donor for first-time guest", async () => {
    const response = await request(app).post("/api/v1/donations/guest").send({
      amount: 50,
      currency: "USD",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: "+1234567890",
      isAnonymous: false,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.matched).toBe(false);

    // Verify donor created
    const donor = await db.query.ContactInformations.findFirst({
      where: eq(ContactInformations.value, "jane@example.com"),
    });
    expect(donor).not.toBeNull();
  });

  it("should match returning guest donor by email", async () => {
    // First donation
    await request(app).post("/api/v1/donations/guest").send({
      amount: 50,
      currency: "USD",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
    });

    // Second donation (should match)
    const response = await request(app).post("/api/v1/donations/guest").send({
      amount: 75,
      currency: "USD",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.matched).toBe(true);
    expect(response.body.data.matchMethod).toBe("email");

    // Verify only one constituent exists
    const constituents = await db.query.ContactInformations.findMany({
      where: eq(ContactInformations.value, "jane@example.com"),
    });
    expect(constituents.length).toBe(1);
  });
});
```

---

## Future Enhancements

### 1. Machine Learning-Based Matching

**Concept**: Use ML to improve name matching accuracy.

- Fuzzy string matching for names with typos
- Learning from admin corrections
- Confidence scoring based on historical accuracy

### 2. Two-Factor Donation Confirmation

**Concept**: Send SMS/Email OTP before processing donation.

**Benefits:**

- Verifies email/phone ownership
- Reduces fraudulent donations
- Enables higher confidence matching

**Tradeoffs:**

- Adds friction to donation process
- May reduce conversion rate

### 3. Donor Portal

**Concept**: Dedicated interface for donors to manage profile and history.

**Features:**

- View all donations (including pre-registration)
- Update contact information
- Manage recurring donations
- Download tax receipts
- Request data deletion (GDPR)

### 4. Admin Dashboard

**Features:**

- Duplicate detection reports
- Manual merge interface
- Matching statistics and accuracy metrics
- Constituent search and management

---

## Appendices

### Appendix A: Matching Decision Matrix

| Input Scenario                | Email Match | Phone Match | Name Match | Decision          | Confidence |
| ----------------------------- | ----------- | ----------- | ---------- | ----------------- | ---------- |
| Anonymous                     | N/A         | N/A         | N/A        | Create NULL donor | 100%       |
| Email provided, matches       | ✓           | -           | -          | Use existing      | 95%        |
| Email provided, no match      | ✗           | -           | -          | Check phone       | -          |
| Phone provided, matches       | -           | ✓           | -          | Use existing      | 85%        |
| Phone provided, no match      | -           | ✗           | -          | Create new        | -          |
| Name + Email matches          | ✓           | -           | ✓          | Use existing      | 95%        |
| Name + Phone matches          | -           | ✓           | ✓          | Use existing      | 80%        |
| Name matches, contacts differ | -           | -           | ✓          | Create new        | -          |

### Appendix B: Database Queries

#### Find Duplicate Constituents by Email

```sql
SELECT
  ci.value AS email,
  COUNT(DISTINCT ci.constituent_id) AS constituent_count,
  STRING_AGG(DISTINCT c.first_name || ' ' || c.last_name, ', ') AS names
FROM core.contact_informations ci
JOIN core.constituents c ON ci.constituent_id = c.id
WHERE ci.contact_type = 'EMAIL'
GROUP BY ci.value
HAVING COUNT(DISTINCT ci.constituent_id) > 1
ORDER BY constituent_count DESC;
```

#### Find Donation History for Email

```sql
SELECT
  d.id AS donation_id,
  ft.amount,
  ft.currency,
  ft.transaction_date,
  c.first_name,
  c.last_name
FROM finance.donations d
JOIN finance.financial_transactions ft ON d.transaction_id = ft.id
JOIN core.donors don ON d.donor_id = don.id
JOIN core.constituents c ON don.constituent_id = c.id
JOIN core.contact_informations ci ON c.id = ci.constituent_id
WHERE ci.contact_type = 'EMAIL'
  AND LOWER(ci.value) = LOWER('john.doe@example.com')
ORDER BY ft.transaction_date DESC;
```

### Appendix C: Implementation Phases

#### Phase 1: Core Matching (Weeks 1-2)

- [ ] Implement matching service
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Deploy to staging environment
- [ ] Performance testing

#### Phase 2: Account Linking (Weeks 3-4)

- [ ] Implement post-registration linking
- [ ] Update registration flow
- [ ] Add user notifications
- [ ] Test linking logic

#### Phase 3: Admin Tools (Weeks 5-6)

- [ ] Duplicate detection reports
- [ ] Manual merge interface
- [ ] Matching analytics dashboard
- [ ] Documentation and training

---

## Conclusion

### Summary

This proposal outlines a **multi-tiered donor matching strategy** that:

1. **Prioritizes email matching** (95% confidence) as the primary method
2. **Falls back to phone matching** (85% confidence) when email unavailable
3. **Respects user privacy** by never matching anonymous donations
4. **Enables post-registration linking** to unify donation history
5. **Provides admin tools** for managing edge cases

### Recommended Implementation

**Phase 1 (Weeks 1-2):** Core matching logic with email and phone tiers  
**Phase 2 (Weeks 3-4):** Account linking and user notification  
**Phase 3 (Weeks 5-6):** Admin tools and duplicate detection

### Expected Impact

- **70-85% reduction** in duplicate donor records
- **Unified donor experience** across guest and authenticated states
- **Improved data quality** for analytics and reporting
- **Maintained privacy** for anonymous donors

### Next Steps

1. **Review this proposal** with stakeholders and technical team
2. **Approve phased implementation plan**
3. **Begin Phase 1 development** with matching service
4. **Set up monitoring** for matching accuracy and performance
5. **Plan user communication** about linking behavior

---

**Document Status:** Ready for Review  
**Author:** GitHub Copilot  
**Last Updated:** January 30, 2025  
**Version:** 1.0
