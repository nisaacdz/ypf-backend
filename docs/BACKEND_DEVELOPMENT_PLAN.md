# YPF Backend Development Plan
## Comprehensive Analysis & Implementation Roadmap

**Document Version:** 1.0  
**Created:** December 18, 2025  
**Last Updated:** December 18, 2025

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Frontend Analysis](#frontend-analysis)
   - [YPF-Africa (Public Website)](#ypf-africa-public-website)
   - [YPF-UMS (Unified Management System)](#ypf-ums-unified-management-system)
3. [Current Backend Status](#current-backend-status)
4. [Gap Analysis](#gap-analysis)
5. [Required API Endpoints](#required-api-endpoints)
6. [Database Schema Requirements](#database-schema-requirements)
7. [Implementation Priority](#implementation-priority)
8. [Technical Specifications](#technical-specifications)

---

## Executive Summary

This document provides a comprehensive analysis of the two frontend applications (ypf-africa and ypf-ums) and outlines the required backend development to fully support both applications. The goal is to migrate from Supabase to the custom Express.js backend while maintaining all existing frontend functionality.

### Key Statistics
- **YPF-Africa Pages:** 15+ public-facing pages
- **YPF-UMS Pages:** 25+ dashboard modules
- **Current Backend Endpoints:** ~12 modules
- **Required New Endpoints:** ~20 modules (estimated 100+ endpoints)

---

## Frontend Analysis

### YPF-Africa (Public Website)

The public-facing website built with React + Vite, currently using Supabase for backend services.

#### Current Supabase Tables Used:
| Table | Purpose | Used In |
|-------|---------|---------|
| `donations` | Store donation records | Donate.tsx |
| `volunteers` | Volunteer applications | VolunteerForm.tsx |
| `events` | Public events | Events.tsx, AdminEvents.tsx |
| `projects` | Project listings | Projects.tsx, ProjectDetail.tsx |
| `products` | Shop products | Shop.tsx, ShopDetail.tsx |
| `orders` | Shop orders | Checkout.tsx |
| `users` | User accounts | AdminUsers.tsx |
| `gallery` (storage) | Gallery images | Gallery.tsx |
| `project_registrations` | Project volunteer signups | ProjectRegistrationForm.tsx |

#### Pages & Features:

##### 1. **Public Pages**
| Page | Route | API Needs |
|------|-------|-----------|
| Home | `/` | Projects, Events, Stats |
| About | `/about` | Static content |
| Contact | `/contact` | Contact form submission |
| Services | `/services` | Services list |
| Donate | `/donate` | Payment processing, Donation records |
| Volunteer | `/volunteer` | Volunteer application submission |
| Events | `/events` | Events list, Event details |
| Projects | `/projects` | Projects list, Project details |
| Gallery | `/gallery` | Gallery images (categorized) |
| Shop | `/shop` | Products list |
| Shop Detail | `/shop/:id` | Product details |
| Cart | `/cart` | Cart management (localStorage) |
| Checkout | `/checkout` | Order creation, Payment processing |
| **Membership Registration** | `/membership-registration` | **NEW: Member registration** |

##### 2. **Admin Dashboard (ypf-africa/admin)**
| Module | Features | API Needs |
|--------|----------|-----------|
| Dashboard | Stats overview | Aggregated statistics |
| Users | User management | CRUD users |
| Donations | Donation tracking | List/export donations |
| Events | Event management | CRUD events |
| Volunteers | Volunteer management | CRUD volunteers, status updates |
| Products | Shop products | CRUD products |
| Orders | Order management | List/update orders |
| Projects | Project management | CRUD projects |
| Project Registrations | Registration management | List/approve registrations |
| Gallery | Image management | Upload/delete images |
| Blog | Blog posts | CRUD blog posts |

##### 3. **Membership Registration Form Data**
```typescript
interface MembershipRegistrationData {
  // Personal Information
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  whatsappNumber: string;
  phoneNumber: string;
  gender: string;
  occupation: string;
  
  // Location & Chapter
  country: string;
  region: string;
  city: string;
  chapter: string;
  campus: string;
  
  // Identification
  nationalIdNumber: string;
  passportPhoto: File;      // File upload
  ghanaCardFront: File;     // File upload
  ghanaCardBack: File;      // File upload
  
  // Membership Status
  membershipStatus: 'executive' | 'general' | 'honorary' | 'new';
  
  // Interests & Mission
  missionPillars: string[]; // community_impact, mentorship_networking, advocacy_awareness
  
  // Referral
  referralSource: string;
  referralOther?: string;
  
  // Commitment
  commitmentStatement: string;
  
  // Leadership
  willingToServe: 'yes' | 'maybe' | 'no';
  preferredRole?: string;
  
  // Emergency Contact
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  
  // Skills & Experience
  skills: string[];
  previousVolunteerExperience?: string;
  
  // Social Media
  linkedinProfile?: string;
  twitterHandle?: string;
  
  // Consent
  agreeToTerms: boolean;
  agreeToPrivacy: boolean;
  declarationConsent: boolean;
}
```

---

### YPF-UMS (Unified Management System)

Internal management dashboard built with Next.js, designed for member and organizational management.

#### User Roles Hierarchy:
```typescript
// Level 100 - Super Admin
'super_admin'

// Level 90 - Executive Leadership
'management_board'

// Level 85 - Advisory
'advisory_board'

// Level 80 - Committee Chairs
'financial_committee_chair' | 'records_committee_chair' | 'digital_committee_chair' |
'legal_committee_chair' | 'hr_committee_chair' | 'program_committee_chair' |
'sponsorship_committee_chair' | 'media_committee_chair' | 'welfare_committee_chair' |
'institutional_committee_chair'

// Level 60 - Committee Members
'financial_committee' | 'records_committee' | 'digital_committee' |
'legal_committee' | 'hr_committee' | 'program_committee' |
'sponsorship_committee' | 'media_committee' | 'welfare_committee' |
'institutional_committee'

// Level 50 - Chapter Leadership
'chapter_lead'

// Level 40 - Chapter Operations
'chapter_head'

// Level 10 - Members
'general_member'

// Level 0 - Guests
'guest'
```

#### Dashboard Modules:

##### **Core Modules (All Users)**
| Module | Route | Features | API Needs |
|--------|-------|----------|-----------|
| Dashboard | `/dashboard` | Role-based overview, stats | Stats aggregation |
| Events | `/dashboard/events` | View/manage events | Events CRUD |
| Programs | `/dashboard/programs` | View/manage programs | Programs CRUD |
| Announcements | `/dashboard/announcements` | View/create announcements | Announcements CRUD |

##### **Member Self-Service**
| Module | Route | Features | API Needs |
|--------|-------|----------|-----------|
| My Dues | `/dashboard/my-dues` | Payment history, pay dues | Dues payments |
| My Certificates | `/dashboard/my-certificates` | View/download certificates | Certificates list |
| My Chapter | `/dashboard/my-chapter` | Chapter info, events | Chapter details |
| Membership Card | `/dashboard/membership-card` | Digital ID card, QR | Member data |
| Profile | `/dashboard/profile` | Edit profile | Profile CRUD |

##### **Administrative Modules**
| Module | Route | Access Level | Features |
|--------|-------|--------------|----------|
| Registrations | `/dashboard/registrations` | Admin, HR | Approve/reject member registrations |
| Members | `/dashboard/members` | Admin, HR, Chapter Leads | Member management |
| Chapters | `/dashboard/chapters` | Admin, Institutional | Chapter management |
| Committees | `/dashboard/committees` | Admin | Committee management |
| Finance | `/dashboard/finance` | Financial Committee | Transactions, budgets |
| Sponsorships | `/dashboard/sponsorships` | Sponsorship Committee | Sponsor management |
| Records | `/dashboard/records` | Records Committee | Document management |
| Reports | `/dashboard/reports` | Admin, Committee Chairs | Report generation |
| HR | `/dashboard/hr` | HR Committee | Personnel management |
| Legal | `/dashboard/legal` | Legal Committee | Legal documents |
| Media | `/dashboard/media` | Media Committee | Media assets |
| Digital | `/dashboard/digital` | Digital Committee | Digital assets |
| Welfare | `/dashboard/welfare` | Welfare Committee | Welfare cases |

#### Key Data Types (from UMS):

```typescript
// User/Member
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  chapter?: string;
  campus?: string;
  country?: string;
  joinedAt: string;
  status: 'active' | 'inactive' | 'pending';
  committees?: string[];
  ghanaCardId?: string;
  ghanaCardFront?: string;
  ghanaCardBack?: string;
  isFirstLogin?: boolean;
}

// Pending Registration
interface PendingRegistration {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  chapter: string;
  campus: string;
  country: string;
  ghanaCardId: string;
  ghanaCardFront: string;
  ghanaCardBack: string;
  registrationDate: string;
  status: 'pending' | 'approved' | 'declined';
  reason?: string;
  declinedReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  assignedRole?: UserRole;
  generatedMemberId?: string;
}

// Chapter
interface Chapter {
  id: string;
  name: string;
  campus: string;
  country: string;
  region: string;
  leadId: string;
  headId?: string;
  memberCount: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
  description?: string;
  email?: string;
  phone?: string;
}

// Committee
interface Committee {
  id: string;
  name: string;
  description: string;
  chairId: string;
  memberIds: string[];
  createdAt: string;
}

// Event
interface Event {
  id: string;
  title: string;
  description: string;
  type: 'webinar' | 'workshop' | 'excursion' | 'meeting' | 'conference' | 'community_service';
  date: string;
  location: string;
  isVirtual: boolean;
  attendees: number;
  maxCapacity?: number;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  createdBy: string;
  chapterId?: string;
}

// Program
interface Program {
  id: string;
  name: string;
  description: string;
  type: 'mentorship' | 'village_childcare' | 'welfare' | 'leadership' | 'networking';
  startDate: string;
  endDate?: string;
  participants: number;
  status: 'active' | 'completed' | 'paused';
  budget?: number;
  committeeId: string;
}

// Transaction
interface Transaction {
  id: string;
  type: 'donation' | 'dues' | 'expense' | 'sponsorship';
  amount: number;
  currency: string;
  description: string;
  date: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  category: string;
  reference?: string;
  userId?: string;
  approvedBy?: string;
}

// Sponsor
interface Sponsor {
  id: string;
  name: string;
  logo?: string;
  contactName: string;
  contactEmail: string;
  phone?: string;
  type: 'corporate' | 'individual' | 'foundation' | 'government';
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  commitment: number;
  startDate: string;
  endDate?: string;
  status: 'active' | 'pending' | 'expired';
}

// Announcement
interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdBy: string;
  createdAt: string;
  targetRoles?: UserRole[];
  targetChapters?: string[];
  isPinned?: boolean;
  readBy?: number;
}

// Welfare Case
interface WelfareCase {
  id: string;
  memberId: string;
  memberName: string;
  type: 'financial_support' | 'medical' | 'educational' | 'emergency' | 'counseling' | 'other';
  title: string;
  description: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requestedAmount?: number;
  approvedAmount?: number;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  chapterId?: string;
}

// Welfare Webinar
interface WelfareWebinar {
  id: string;
  title: string;
  description: string;
  type: 'mental_health' | 'career_development' | 'financial_wellness' | 'leadership' | 'skills_training';
  facilitator: string;
  date: string;
  duration: number;
  isVirtual: boolean;
  meetingLink?: string;
  location?: string;
  maxParticipants: number;
  registeredParticipants: number;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  resources?: string[];
  createdBy: string;
}

// Media Item
interface MediaItem {
  id: string;
  title: string;
  description?: string;
  type: 'image' | 'video' | 'document' | 'graphic' | 'audio';
  url: string;
  thumbnailUrl?: string;
  size: number;
  category: 'event' | 'program' | 'promotional' | 'documentation' | 'social_media';
  tags: string[];
  uploadedBy: string;
  uploadedAt: string;
  eventId?: string;
  programId?: string;
  isPublic: boolean;
}

// Content Calendar Item
interface ContentCalendarItem {
  id: string;
  title: string;
  description: string;
  platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'website' | 'newsletter';
  scheduledDate: string;
  status: 'draft' | 'scheduled' | 'published' | 'cancelled';
  content: string;
  mediaIds: string[];
  createdBy: string;
  approvedBy?: string;
}

// Report
interface Report {
  id: string;
  title: string;
  type: 'financial' | 'membership' | 'chapter' | 'program' | 'event' | 'impact' | 'annual';
  description: string;
  period: { startDate: string; endDate: string };
  generatedBy: string;
  generatedAt: string;
  status: 'generating' | 'ready' | 'error';
  fileUrl?: string;
  data?: Record<string, unknown>;
  isAutoGenerated?: boolean;
}

// Budget
interface Budget {
  id: string;
  name: string;
  fiscalYear: string;
  totalAmount: number;
  allocatedAmount: number;
  spentAmount: number;
  category: 'programs' | 'events' | 'operations' | 'welfare' | 'marketing' | 'chapter_support';
  status: 'draft' | 'pending_approval' | 'approved' | 'active' | 'closed';
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
  lineItems: BudgetLineItem[];
}

// Budget Line Item
interface BudgetLineItem {
  id: string;
  description: string;
  category: string;
  estimatedAmount: number;
  actualAmount: number;
  status: 'pending' | 'approved' | 'spent';
}

// Expense Request
interface ExpenseRequest {
  id: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  budgetId?: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  approvedBy?: string;
  approvedAt?: string;
  receiptUrl?: string;
  notes?: string;
}

// Certificate
interface Certificate {
  id: string;
  memberId: string;
  title: string;
  programName: string;
  programId: string;
  issuedDate: string;
  expiryDate?: string;
  certificateNumber: string;
  status: 'active' | 'expired' | 'revoked';
  downloadUrl: string;
  type: 'completion' | 'participation' | 'achievement' | 'leadership';
}

// Dues Payment
interface DuesPayment {
  id: string;
  memberId: string;
  amount: number;
  currency: string;
  month: string;
  year: number;
  dueDate: string;
  paidDate?: string;
  status: 'paid' | 'pending' | 'overdue';
  paymentMethod?: 'mobile_money' | 'bank_transfer' | 'card' | 'cash';
  reference?: string;
}

// Membership Card
interface MembershipCard {
  memberId: string;
  membershipId: string;
  fullName: string;
  role: UserRole;
  chapter: string;
  campus: string;
  country: string;
  joinedDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'suspended';
  qrCode: string;
  photoUrl?: string;
}

// Event Registration
interface EventRegistration {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  eventType: string;
  isVirtual: boolean;
  registeredAt: string;
  status: 'registered' | 'attended' | 'cancelled' | 'no_show';
  meetingLink?: string;
}

// Program Enrollment
interface ProgramEnrollment {
  id: string;
  programId: string;
  programName: string;
  programType: string;
  enrolledDate: string;
  status: 'enrolled' | 'active' | 'completed' | 'withdrawn';
  progress: number;
  completedDate?: string;
  certificateId?: string;
}

// Notification
interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  link?: string;
}

// Document
interface Document {
  id: string;
  name: string;
  description?: string;
  category: 'governance' | 'financial' | 'legal' | 'hr' | 'program' | 'event' | 'other';
  type: 'pdf' | 'docx' | 'xlsx' | 'image' | 'other';
  size: number;
  folderId?: string;
  uploadedBy: string;
  uploadedAt: string;
  lastModified: string;
  version: string;
  accessLevel: 'public' | 'committee' | 'admin' | 'restricted';
  tags: string[];
  downloadCount: number;
}

// Folder
interface Folder {
  id: string;
  name: string;
  parentId?: string;
  description?: string;
  accessLevel: 'public' | 'committee' | 'admin' | 'restricted';
  createdBy: string;
  createdAt: string;
}
```

---

## Current Backend Status

### Existing API Modules:
| Module | Endpoints | Status |
|--------|-----------|--------|
| Auth | Login, Logout, Forgot/Reset Password | ✅ Complete |
| Users | Get user data | ⚠️ Partial |
| Members | List members | ⚠️ Partial |
| Chapters | List/Get chapters | ⚠️ Partial |
| Committees | List/Get committees | ⚠️ Partial |
| Events | CRUD events | ⚠️ Partial |
| Projects | CRUD projects | ✅ Complete |
| Donations | Process donations | ⚠️ Partial |
| Transactions | Verify transactions | ⚠️ Partial |
| Shop | Products, Cart, Orders | ⚠️ Partial |
| Announcements | Create announcements | ⚠️ Minimal |
| Webhooks | Paystack webhooks | ✅ Complete |

### Existing Database Schema:
| Schema | Tables | Status |
|--------|--------|--------|
| core | Constituents, Members, Chapters, Committees, etc. | ✅ Exists |
| activities | Projects, Events, Announcements | ✅ Exists |
| finance | Donations, Dues, Expenditures, Partnerships | ✅ Exists |
| shop | Products, Orders, etc. | ✅ Exists |

---

## Gap Analysis

### ❌ MISSING MODULES (Need Complete Implementation)

#### 1. **Registrations Module** ⚠️ CRITICAL
```
Purpose: Handle new member registration applications
Priority: P0 (Critical)
```

**Required Endpoints:**
- `POST /api/v1/registrations` - Submit registration
- `GET /api/v1/registrations` - List registrations (paginated, filtered)
- `GET /api/v1/registrations/:id` - Get registration details
- `PUT /api/v1/registrations/:id/approve` - Approve registration
- `PUT /api/v1/registrations/:id/decline` - Decline registration
- `GET /api/v1/registrations/stats` - Registration statistics

**Database Table:**
```sql
CREATE TABLE core.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Personal Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  whatsapp_number TEXT,
  date_of_birth DATE,
  gender TEXT,
  occupation TEXT,
  
  -- Location
  country TEXT NOT NULL,
  region TEXT,
  city TEXT,
  chapter_id UUID REFERENCES core.chapters(id),
  campus TEXT,
  
  -- Identification
  national_id_number TEXT,
  passport_photo_id UUID REFERENCES core.media(id),
  ghana_card_front_id UUID REFERENCES core.media(id),
  ghana_card_back_id UUID REFERENCES core.media(id),
  
  -- Membership
  membership_status TEXT NOT NULL, -- executive, general, honorary, new
  mission_pillars TEXT[], -- Array of interests
  referral_source TEXT,
  referral_other TEXT,
  
  -- Commitment
  commitment_statement TEXT,
  willing_to_serve TEXT, -- yes, maybe, no
  preferred_role TEXT,
  
  -- Emergency Contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  
  -- Skills
  skills TEXT[],
  previous_volunteer_experience TEXT,
  
  -- Social Media
  linkedin_profile TEXT,
  twitter_handle TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, declined
  declined_reason TEXT,
  approved_by UUID REFERENCES core.admins(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  assigned_role TEXT,
  generated_member_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. **Programs Module** ⚠️ CRITICAL
```
Purpose: Manage YPF programs
Priority: P0 (Critical)
```

**Required Endpoints:**
- `GET /api/v1/programs` - List programs
- `GET /api/v1/programs/:id` - Get program details
- `POST /api/v1/programs` - Create program
- `PUT /api/v1/programs/:id` - Update program
- `DELETE /api/v1/programs/:id` - Delete program
- `GET /api/v1/programs/:id/participants` - List participants
- `POST /api/v1/programs/:id/enroll` - Enroll in program
- `DELETE /api/v1/programs/:id/enroll` - Withdraw from program

**Database Tables:**
```sql
CREATE TABLE activities.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- mentorship, village_childcare, welfare, leadership, networking
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active', -- active, completed, paused
  budget DECIMAL(12, 2),
  max_participants INTEGER,
  committee_id UUID REFERENCES core.committees(id),
  chapter_id UUID REFERENCES core.chapters(id),
  created_by UUID REFERENCES core.constituents(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE activities.program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES activities.programs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES core.members(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'enrolled', -- enrolled, active, completed, withdrawn
  progress INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  certificate_id UUID,
  UNIQUE(program_id, member_id)
);
```

#### 3. **Sponsorships Module** ⚠️ HIGH
```
Purpose: Manage sponsors and partnerships
Priority: P1 (High)
```

**Required Endpoints:**
- `GET /api/v1/sponsorships` - List sponsors
- `GET /api/v1/sponsorships/:id` - Get sponsor details
- `POST /api/v1/sponsorships` - Create sponsor
- `PUT /api/v1/sponsorships/:id` - Update sponsor
- `DELETE /api/v1/sponsorships/:id` - Delete sponsor
- `GET /api/v1/sponsorships/proposals` - List proposals
- `POST /api/v1/sponsorships/proposals` - Submit proposal
- `PUT /api/v1/sponsorships/proposals/:id` - Update proposal status

**Database Enhancement:**
```sql
-- Enhance existing Partnerships table or create Sponsors table
CREATE TABLE finance.sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES core.organizations(id),
  name TEXT NOT NULL,
  logo_id UUID REFERENCES core.media(id),
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  type TEXT NOT NULL, -- corporate, individual, foundation, government
  tier TEXT NOT NULL, -- platinum, gold, silver, bronze
  commitment DECIMAL(12, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, expired
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE finance.sponsorship_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID REFERENCES finance.sponsors(id),
  title TEXT NOT NULL,
  description TEXT,
  proposed_amount DECIMAL(12, 2),
  proposed_tier TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, submitted, under_review, accepted, rejected
  submitted_by UUID REFERENCES core.constituents(id),
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES core.admins(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. **Welfare Module** ⚠️ HIGH
```
Purpose: Member welfare case management
Priority: P1 (High)
```

**Required Endpoints:**
- `GET /api/v1/welfare/cases` - List welfare cases
- `GET /api/v1/welfare/cases/:id` - Get case details
- `POST /api/v1/welfare/cases` - Submit case
- `PUT /api/v1/welfare/cases/:id` - Update case
- `PUT /api/v1/welfare/cases/:id/assign` - Assign case
- `PUT /api/v1/welfare/cases/:id/approve` - Approve case
- `PUT /api/v1/welfare/cases/:id/reject` - Reject case
- `PUT /api/v1/welfare/cases/:id/resolve` - Resolve case
- `GET /api/v1/welfare/webinars` - List webinars
- `POST /api/v1/welfare/webinars` - Create webinar
- `PUT /api/v1/welfare/webinars/:id` - Update webinar
- `POST /api/v1/welfare/webinars/:id/register` - Register for webinar

**Database Tables:**
```sql
CREATE TABLE activities.welfare_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES core.members(id),
  type TEXT NOT NULL, -- financial_support, medical, educational, emergency, counseling, other
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, under_review, approved, rejected, resolved
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
  requested_amount DECIMAL(12, 2),
  approved_amount DECIMAL(12, 2),
  assigned_to UUID REFERENCES core.constituents(id),
  chapter_id UUID REFERENCES core.chapters(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE activities.welfare_webinars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- mental_health, career_development, financial_wellness, leadership, skills_training
  facilitator TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL, -- minutes
  is_virtual BOOLEAN DEFAULT true,
  meeting_link TEXT,
  location TEXT,
  max_participants INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, ongoing, completed, cancelled
  resources TEXT[],
  created_by UUID REFERENCES core.constituents(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE activities.webinar_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webinar_id UUID NOT NULL REFERENCES activities.welfare_webinars(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES core.members(id) ON DELETE CASCADE,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  attended BOOLEAN DEFAULT false,
  UNIQUE(webinar_id, member_id)
);
```

#### 5. **Documents/Records Module** ⚠️ HIGH
```
Purpose: Document management system
Priority: P1 (High)
```

**Required Endpoints:**
- `GET /api/v1/documents` - List documents
- `GET /api/v1/documents/:id` - Get document details
- `POST /api/v1/documents` - Upload document
- `PUT /api/v1/documents/:id` - Update document metadata
- `DELETE /api/v1/documents/:id` - Delete document
- `GET /api/v1/documents/:id/download` - Download document
- `GET /api/v1/folders` - List folders
- `POST /api/v1/folders` - Create folder
- `PUT /api/v1/folders/:id` - Update folder
- `DELETE /api/v1/folders/:id` - Delete folder

**Database Tables:**
```sql
CREATE TABLE core.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES core.folders(id) ON DELETE CASCADE,
  description TEXT,
  access_level TEXT NOT NULL DEFAULT 'committee', -- public, committee, admin, restricted
  created_by UUID REFERENCES core.constituents(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE core.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- governance, financial, legal, hr, program, event, other
  type TEXT NOT NULL, -- pdf, docx, xlsx, image, other
  file_id UUID NOT NULL REFERENCES core.media(id),
  size INTEGER NOT NULL,
  folder_id UUID REFERENCES core.folders(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES core.constituents(id),
  version TEXT DEFAULT '1.0',
  access_level TEXT NOT NULL DEFAULT 'committee', -- public, committee, admin, restricted
  tags TEXT[],
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 6. **Reports Module** ⚠️ MEDIUM
```
Purpose: Generate and manage reports
Priority: P2 (Medium)
```

**Required Endpoints:**
- `GET /api/v1/reports` - List reports
- `GET /api/v1/reports/:id` - Get report details
- `POST /api/v1/reports/generate` - Generate report
- `GET /api/v1/reports/templates` - List templates
- `GET /api/v1/reports/:id/download` - Download report

**Database Tables:**
```sql
CREATE TABLE core.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- financial, membership, chapter, program, event, impact, annual
  description TEXT,
  schema JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE core.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  template_id UUID REFERENCES core.report_templates(id),
  period_start DATE,
  period_end DATE,
  generated_by UUID NOT NULL REFERENCES core.constituents(id),
  status TEXT NOT NULL DEFAULT 'generating', -- generating, ready, error
  file_id UUID REFERENCES core.media(id),
  data JSONB,
  is_auto_generated BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);
```

#### 7. **Certificates Module** ⚠️ MEDIUM
```
Purpose: Issue and manage certificates
Priority: P2 (Medium)
```

**Required Endpoints:**
- `GET /api/v1/certificates` - List certificates
- `GET /api/v1/certificates/my` - Get user's certificates
- `GET /api/v1/certificates/:id` - Get certificate details
- `POST /api/v1/certificates/issue` - Issue certificate
- `GET /api/v1/certificates/:id/download` - Download certificate
- `PUT /api/v1/certificates/:id/revoke` - Revoke certificate
- `GET /api/v1/certificates/verify/:number` - Verify certificate

**Database Table:**
```sql
CREATE TABLE core.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES core.members(id),
  certificate_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  program_id UUID REFERENCES activities.programs(id),
  event_id UUID REFERENCES activities.events(id),
  type TEXT NOT NULL, -- completion, participation, achievement, leadership
  issued_date DATE NOT NULL,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'active', -- active, expired, revoked
  file_id UUID REFERENCES core.media(id),
  issued_by UUID REFERENCES core.constituents(id),
  revoked_by UUID REFERENCES core.constituents(id),
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 8. **Dues Management Module** ⚠️ HIGH
```
Purpose: Member dues tracking and payment
Priority: P1 (High)
```

**Required Endpoints:**
- `GET /api/v1/dues` - List dues configurations
- `GET /api/v1/dues/:id` - Get dues details
- `POST /api/v1/dues` - Create dues period
- `PUT /api/v1/dues/:id` - Update dues
- `GET /api/v1/dues/my` - Get current user's dues summary
- `GET /api/v1/dues/my/payments` - Get payment history
- `POST /api/v1/dues/pay` - Process dues payment
- `GET /api/v1/dues/overdue` - List overdue members
- `GET /api/v1/dues/stats` - Dues statistics

#### 9. **Budgets & Expenses Module** ⚠️ MEDIUM
```
Purpose: Budget management and expense tracking
Priority: P2 (Medium)
```

**Required Endpoints:**
- `GET /api/v1/budgets` - List budgets
- `GET /api/v1/budgets/:id` - Get budget details
- `POST /api/v1/budgets` - Create budget
- `PUT /api/v1/budgets/:id` - Update budget
- `DELETE /api/v1/budgets/:id` - Delete budget
- `POST /api/v1/budgets/:id/line-items` - Add line item
- `PUT /api/v1/budgets/:id/line-items/:itemId` - Update line item
- `GET /api/v1/expenses/requests` - List expense requests
- `POST /api/v1/expenses/requests` - Submit expense request
- `PUT /api/v1/expenses/requests/:id/approve` - Approve expense
- `PUT /api/v1/expenses/requests/:id/reject` - Reject expense

**Database Tables:**
```sql
CREATE TABLE finance.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  allocated_amount DECIMAL(12, 2) DEFAULT 0,
  spent_amount DECIMAL(12, 2) DEFAULT 0,
  category TEXT NOT NULL, -- programs, events, operations, welfare, marketing, chapter_support
  status TEXT NOT NULL DEFAULT 'draft', -- draft, pending_approval, approved, active, closed
  committee_id UUID REFERENCES core.committees(id),
  created_by UUID NOT NULL REFERENCES core.constituents(id),
  approved_by UUID REFERENCES core.constituents(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE finance.budget_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES finance.budgets(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  estimated_amount DECIMAL(12, 2) NOT NULL,
  actual_amount DECIMAL(12, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, spent
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE finance.expense_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  category TEXT NOT NULL,
  budget_id UUID REFERENCES finance.budgets(id),
  budget_line_item_id UUID REFERENCES finance.budget_line_items(id),
  requested_by UUID NOT NULL REFERENCES core.constituents(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, paid
  approved_by UUID REFERENCES core.constituents(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  receipt_file_id UUID REFERENCES core.media(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 10. **Media Library Module** ⚠️ LOW
```
Purpose: Media asset management
Priority: P3 (Low)
```

**Required Endpoints:**
- `GET /api/v1/media-library` - List media items
- `GET /api/v1/media-library/:id` - Get media details
- `POST /api/v1/media-library/upload` - Upload media
- `PUT /api/v1/media-library/:id` - Update metadata
- `DELETE /api/v1/media-library/:id` - Delete media
- `GET /api/v1/content-calendar` - Get content calendar
- `POST /api/v1/content-calendar` - Create calendar item
- `PUT /api/v1/content-calendar/:id` - Update calendar item

#### 11. **Notifications Module** ⚠️ MEDIUM
```
Purpose: User notifications
Priority: P2 (Medium)
```

**Required Endpoints:**
- `GET /api/v1/notifications` - List user notifications
- `GET /api/v1/notifications/unread/count` - Get unread count
- `PUT /api/v1/notifications/:id/read` - Mark as read
- `PUT /api/v1/notifications/read-all` - Mark all as read
- `DELETE /api/v1/notifications/:id` - Delete notification

**Database Table:**
```sql
CREATE TABLE core.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES core.constituents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- info, success, warning, error
  read BOOLEAN DEFAULT false,
  link TEXT,
  related_entity_type TEXT, -- event, program, announcement, etc.
  related_entity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 12. **Membership Card Module** ⚠️ LOW
```
Purpose: Digital membership cards
Priority: P3 (Low)
```

**Required Endpoints:**
- `GET /api/v1/membership-card` - Get user's card data
- `GET /api/v1/membership-card/qr` - Generate QR code
- `POST /api/v1/membership-card/verify` - Verify by QR/ID
- `GET /api/v1/membership-card/download` - Download card PDF

---

### ⚠️ INCOMPLETE MODULES (Need Enhancement)

#### 1. **Announcements Module**
**Current:** Only POST endpoint
**Missing:**
- `GET /api/v1/announcements` - List announcements
- `GET /api/v1/announcements/:id` - Get details
- `PUT /api/v1/announcements/:id` - Update
- `DELETE /api/v1/announcements/:id` - Delete
- `PUT /api/v1/announcements/:id/pin` - Pin/unpin
- `POST /api/v1/announcements/:id/read` - Mark as read

#### 2. **Members Module**
**Current:** Basic list endpoint
**Missing:**
- `POST /api/v1/members` - Create member
- `PUT /api/v1/members/:id` - Update member
- `DELETE /api/v1/members/:id` - Remove member
- `GET /api/v1/members/:id/certificates` - Member certificates
- `GET /api/v1/members/:id/dues` - Member dues
- `GET /api/v1/members/:id/programs` - Member programs
- `GET /api/v1/members/:id/events` - Member events
- `POST /api/v1/members/:id/assign-role` - Assign role
- `POST /api/v1/members/:id/assign-title` - Assign title

#### 3. **Chapters Module**
**Current:** Basic CRUD
**Missing:**
- `GET /api/v1/chapters/:id/members` - Chapter members
- `GET /api/v1/chapters/:id/events` - Chapter events
- `GET /api/v1/chapters/:id/stats` - Chapter statistics
- `POST /api/v1/chapters/:id/assign-lead` - Assign lead
- `POST /api/v1/chapters/:id/assign-head` - Assign head

#### 4. **Committees Module**
**Current:** Basic GET endpoints
**Missing:**
- `POST /api/v1/committees` - Create committee
- `PUT /api/v1/committees/:id` - Update committee
- `DELETE /api/v1/committees/:id` - Delete committee
- `POST /api/v1/committees/:id/members` - Add member
- `DELETE /api/v1/committees/:id/members/:memberId` - Remove member
- `POST /api/v1/committees/:id/assign-chair` - Assign chair

#### 5. **Events Module**
**Current:** Basic CRUD
**Missing:**
- `POST /api/v1/events/:id/register` - Register for event
- `DELETE /api/v1/events/:id/register` - Cancel registration
- `GET /api/v1/events/:id/attendees` - List attendees
- `POST /api/v1/events/:id/attendance/:memberId` - Mark attendance
- `GET /api/v1/events/my` - User's event registrations

#### 6. **Dashboard/Stats Module** ⚠️ NEW
**Required Endpoints:**
- `GET /api/v1/dashboard/stats` - Get role-based statistics
- `GET /api/v1/dashboard/activity` - Recent activity
- `GET /api/v1/dashboard/charts/donations` - Donation trends
- `GET /api/v1/dashboard/charts/members` - Member growth
- `GET /api/v1/dashboard/charts/regional` - Regional distribution

---

## Implementation Priority

### Phase 1: Critical (Weeks 1-2)
| Module | Priority | Effort | Dependencies |
|--------|----------|--------|--------------|
| Registrations | P0 | High | Media uploads |
| Dues Management | P0 | Medium | Finance schema |
| Members Enhancement | P0 | Medium | Registrations |
| Auth Enhancement | P0 | Low | - |

### Phase 2: High Priority (Weeks 3-4)
| Module | Priority | Effort | Dependencies |
|--------|----------|--------|--------------|
| Programs | P1 | High | - |
| Certificates | P1 | Medium | Programs, Events |
| Sponsorships | P1 | Medium | Finance schema |
| Welfare | P1 | High | - |
| Dashboard Stats | P1 | Medium | All modules |

### Phase 3: Important (Weeks 5-6)
| Module | Priority | Effort | Dependencies |
|--------|----------|--------|--------------|
| Documents/Records | P2 | High | Media |
| Reports | P2 | High | All data modules |
| Budgets & Expenses | P2 | Medium | Finance |
| Notifications | P2 | Medium | - |
| Announcements Enhancement | P2 | Low | - |

### Phase 4: Enhancement (Weeks 7-8)
| Module | Priority | Effort | Dependencies |
|--------|----------|--------|--------------|
| Media Library | P3 | Medium | Media |
| Membership Cards | P3 | Medium | Members |
| Content Calendar | P3 | Medium | Media |
| Export Functionality | P3 | Low | Reports |

---

## Technical Specifications

### API Design Principles
1. RESTful endpoints following existing patterns
2. Consistent response format: `{ success: boolean, data?: T, message?: string }`
3. Paginated list responses: `{ items: T[], page: number, pageSize: number, total: number }`
4. Zod validation for all request bodies/params/queries
5. Role-based authorization middleware

### File Upload Strategy
- Use existing Cloudinary integration (`configs/fs/cdn.ts`)
- Support for images, PDFs, documents
- Automatic thumbnail generation for images
- Virus scanning for document uploads

### Email Notifications
- Use existing Nodemailer setup (`configs/emailer`)
- Templates for: Registration, Approval, Certificates, Dues reminders
- Queue system for bulk emails (consider Bull/Redis)

### Authorization Enhancement
```typescript
// Extend existing authorizer for granular permissions
const MODULE_ACCESS = {
  registrations: ['SUPER_ADMIN', 'HR_COMMITTEE'],
  finance: ['SUPER_ADMIN', 'FINANCIAL_COMMITTEE'],
  welfare: ['SUPER_ADMIN', 'WELFARE_COMMITTEE'],
  sponsorships: ['SUPER_ADMIN', 'SPONSORSHIP_COMMITTEE'],
  // ... etc
};
```

### Background Jobs (Consider Adding)
- Report generation
- Email campaigns
- Data aggregation for dashboard
- Certificate PDF generation
- Dues reminder notifications

---

## Migration from Supabase

### YPF-Africa Migration Steps:
1. Create API service layer in frontend
2. Replace Supabase client calls with API calls
3. Update environment variables
4. Migrate file uploads from Supabase Storage to Cloudinary
5. Update authentication flow

### Tables to Migrate:
- `donations` → `/api/v1/donations`
- `volunteers` → `/api/v1/volunteers` (new)
- `events` → `/api/v1/events`
- `projects` → `/api/v1/projects`
- `products` → `/api/v1/shop/products`
- `orders` → `/api/v1/shop/orders`
- `users` → `/api/v1/users`
- `project_registrations` → `/api/v1/projects/:id/registrations`
- `gallery` storage → `/api/v1/gallery`

---

## Next Steps

1. **Review this document** with the team
2. **Prioritize** based on business needs
3. **Create database migrations** for new tables
4. **Implement Phase 1** modules first
5. **Set up frontend API services** in parallel
6. **Test thoroughly** with frontend integration
7. **Deploy incrementally** by module

---

## Appendix

### Existing Backend File Structure
```
ypf-backend/
├── features/api/v1/
│   ├── announcements/     # Needs enhancement
│   ├── auth/              # Complete
│   ├── chapters/          # Needs enhancement
│   ├── committees/        # Needs enhancement
│   ├── donations/         # Partial
│   ├── events/            # Needs enhancement
│   ├── members/           # Needs enhancement
│   ├── projects/          # Complete
│   ├── shop/              # Partial
│   ├── transactions/      # Partial
│   ├── users/             # Partial
│   └── webhooks/          # Complete
├── shared/
│   ├── dtos/              # Add new DTOs
│   ├── middlewares/       # Extend auth
│   ├── services/          # Add new services
│   ├── types/             # Add new types
│   ├── utils/             # Extend utilities
│   └── validators/        # Add new validators
└── db/schema/             # Add new tables
```

### New Modules Structure
```
features/api/v1/
├── registrations/
│   ├── index.ts
│   ├── registrationsHandler.ts
├── programs/
│   ├── index.ts
│   ├── programsHandler.ts
├── sponsorships/
│   ├── index.ts
│   ├── sponsorshipsHandler.ts
├── welfare/
│   ├── index.ts
│   ├── welfareHandler.ts
├── documents/
│   ├── index.ts
│   ├── documentsHandler.ts
├── reports/
│   ├── index.ts
│   ├── reportsHandler.ts
├── certificates/
│   ├── index.ts
│   ├── certificatesHandler.ts
├── budgets/
│   ├── index.ts
│   ├── budgetsHandler.ts
├── notifications/
│   ├── index.ts
│   ├── notificationsHandler.ts
├── dues/
│   ├── index.ts
│   ├── duesHandler.ts
├── dashboard/
│   ├── index.ts
│   ├── dashboardHandler.ts
├── gallery/
│   ├── index.ts
│   ├── galleryHandler.ts
└── volunteers/
    ├── index.ts
    └── volunteersHandler.ts
```

---

*Document prepared for YPF Africa Backend Development Team*
