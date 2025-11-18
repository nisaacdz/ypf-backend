# Donor Attribution Strategy

**Status:** Partially Implemented (Direct Attribution only)

## Overview

Donor attribution is the process of linking a financial transaction (donation) to a specific constituent (user) in the system. Currently, the system supports **Direct Attribution** at the time of donation.

## Direct Attribution

Direct attribution occurs when the donation is initiated.

### 1. Authenticated User

If a user is logged in when making a donation:

- The `constituentId` is automatically linked to the `Donations` record.
- The transaction is fully attributed to that user.

### 2. Guest Donation (with Contact Info)

If a user donates as a guest but provides a name and email:

- The `guestName` and `guestEmail` are stored in the `Donations` record.
- **Current Limitation:** These are NOT automatically linked to an existing constituent profile, even if the email matches. They remain as "Guest" donations in the database.

### 3. Anonymous Donation

- No `constituentId`, `guestName`, or `guestEmail` is stored.
- These donations are permanently anonymous and cannot be attributed.

## Manual Reconciliation (TODO)

**Status:** Not Implemented

There is currently no workflow for:

1. Matching "Guest" donations to existing Constituent profiles based on email.
2. Manually linking an unlinked transaction to a constituent by an Admin.
3. Handling offline payments (Bank Transfer) that need manual entry and attribution.

### Future Implementation Plan

- **Auto-Linker:** A background job that finds Guest donations with emails matching existing Constituents and links them.
- **Admin Interface:** A UI for admins to search for unlinked donations and assign them to a constituent.
