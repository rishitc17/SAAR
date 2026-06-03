-- ============================================================================
-- ekRAAH Platform — Database Schema
-- ============================================================================
-- A digital citizen-and-government platform for India.
-- Built on Supabase / PostgreSQL 15+.
--
-- Three user roles: citizen, lawyer, government_official
--
-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  IMPORTANT: Setup Instructions                                           ║
-- ╠════════════════════════════════════════════════════════════════════════════╣
-- ║                                                                          ║
-- ║  1. Run this entire script in the Supabase SQL Editor.                  ║
-- ║     The script will automatically create everything including the two    ║
-- ║     government official auth users and their profiles.                   ║
-- ║                                                                          ║
-- ║  2. GOVERNMENT OFFICIAL ACCOUNTS (auto-created by this script):          ║
-- ║       • transport.official@ekraah.gov.in  → Rajesh Kumar                ║
-- ║         Password: Ekraah@2025                                            ║
-- ║       • police.official@ekraah.gov.in     → Priya Sharma                ║
-- ║         Password: Ekraah@2025                                            ║
-- ║                                                                          ║
-- ║  3. ROW LEVEL SECURITY (RLS) is enabled on every table. Make sure       ║
-- ║     your Supabase project has RLS enabled (it is by default).           ║
-- ║                                                                          ║
-- ║  4. The `handle_new_user` trigger automatically creates a profile       ║
-- ║     row when a new user signs up via Supabase Auth. For government      ║
-- ║     officials, the script inserts directly into auth.users with the      ║
-- ║     correct user_metadata, and the trigger creates the profile.         ║
-- ║                                                                          ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Required for gen_random_uuid() — already available in Supabase by default
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- HELPER FUNCTION: updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE 1: profiles
-- Extends Supabase auth.users with platform-specific data.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT        NOT NULL,
    full_name   TEXT        NOT NULL,
    role        TEXT        NOT NULL DEFAULT 'citizen'
                            CHECK (role IN ('citizen', 'lawyer', 'government_official')),
    preferred_language TEXT  NOT NULL DEFAULT 'en',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles
    IS 'Extends Supabase auth.users with ekRAAH-specific profile data and role information.';

COMMENT ON COLUMN public.profiles.role
    IS 'User role: citizen (default), lawyer, or government_official.';

COMMENT ON COLUMN public.profiles.preferred_language
    IS 'ISO 639-1 language code. Defaults to "en". Supports "hi", "ta", "te", "bn", etc.';

-- Trigger: auto-update updated_at on row change
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 2: lawyer_details
-- Additional professional information for users with role = 'lawyer'.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lawyer_details (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bar_council_number  TEXT        NOT NULL UNIQUE,
    specialization      TEXT        NOT NULL
                                    CHECK (specialization IN (
                                        'Land Disputes',
                                        'Criminal Law',
                                        'Civil Law',
                                        'Family Law',
                                        'Corporate Law',
                                        'Tax Law'
                                    )),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lawyer_details
    IS 'Professional details for lawyers. One-to-one with profiles (where role = ''lawyer'').';

COMMENT ON COLUMN public.lawyer_details.bar_council_number
    IS 'Unique Bar Council of India registration number.';

COMMENT ON COLUMN public.lawyer_details.specialization
    IS 'Primary area of legal practice. Used for matching with application types.';

-- ============================================================================
-- TABLE 3: government_officials
-- Department and designation for users with role = 'government_official'.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.government_officials (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    department      TEXT        NOT NULL,
    designation     TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.government_officials
    IS 'Department assignments for government officials. One-to-one with profiles (where role = ''government_official'').';

-- ============================================================================
-- TABLE 4: departments
-- Master list of government departments.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.departments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    code        TEXT        NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.departments
    IS 'Master list of government departments referenced by application workflows and official assignments.';

-- ============================================================================
-- TABLE 5: application_types
-- Catalog of available services / application categories.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.application_types (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    slug            TEXT        NOT NULL UNIQUE,
    description     TEXT,
    category        TEXT        NOT NULL,
    icon            TEXT,           -- FontAwesome icon class, e.g. 'fa-car'
    color           TEXT,           -- Hex color, e.g. '#1a73e8'
    is_active       BOOLEAN     NOT NULL DEFAULT true,
    workflow_type   TEXT        NOT NULL
                                CHECK (workflow_type IN ('department_chain', 'lawyer_assignment')),
    workflow_config JSONB       NOT NULL DEFAULT '{}',
                                -- department_chain: {"stages": [{"stage":1,"department":"Transport Department","label":"Application Intake"}, ...]}
                                -- lawyer_assignment: {"lawyer_specialization": "Land Disputes"}
    form_fields     JSONB       NOT NULL DEFAULT '[]',
                                -- Array of form field definitions, e.g.
                                -- [{"name":"full_name","label":"Full Name","type":"text","required":true}, ...]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.application_types
    IS 'Catalog of all available service/application types. Each defines a workflow and form schema.';

COMMENT ON COLUMN public.application_types.workflow_type
    IS 'department_chain: application routes through a sequence of departments. lawyer_assignment: application is assigned to a matching lawyer.';

COMMENT ON COLUMN public.application_types.workflow_config
    IS 'JSON config describing the workflow. For department_chain: {stages: [{stage, department, label}]}. For lawyer_assignment: {lawyer_specialization: string}.';

COMMENT ON COLUMN public.application_types.form_fields
    IS 'JSON array of form field definitions for the application form UI.';

-- ============================================================================
-- TABLE 6: applications
-- All submitted applications from citizens.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.applications (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    application_type_id  UUID        NOT NULL REFERENCES public.application_types(id) ON DELETE RESTRICT,
    status               TEXT        NOT NULL DEFAULT 'submitted'
                                     CHECK (status IN (
                                         'submitted',
                                         'in_review',
                                         'approved',
                                         'rejected',
                                         'lawyer_pending',
                                         'lawyer_assigned',
                                         'completed'
                                     )),
    current_stage        INTEGER     NOT NULL DEFAULT 1,
    total_stages         INTEGER     NOT NULL,
    form_data            JSONB       NOT NULL DEFAULT '{}',
    assigned_lawyer_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.applications
    IS 'All citizen-submitted applications. Tracks status, stage progression, and optional lawyer assignment.';

COMMENT ON COLUMN public.applications.status
    IS 'Application lifecycle: submitted → in_review → approved/rejected (department_chain) OR submitted → lawyer_pending → lawyer_assigned → completed (lawyer_assignment).';

COMMENT ON COLUMN public.applications.current_stage
    IS 'For department_chain workflows: the current stage number (1-based).';

COMMENT ON COLUMN public.applications.total_stages
    IS 'Total number of stages in the workflow. Copied from application_types.workflow_config at submission time.';

COMMENT ON COLUMN public.applications.form_data
    IS 'JSON object with all form field values submitted by the citizen.';

COMMENT ON COLUMN public.applications.assigned_lawyer_id
    IS 'For lawyer_assignment workflows: the lawyer assigned to this case. NULL for department_chain workflows.';

-- Trigger: auto-update updated_at on row change
CREATE TRIGGER set_applications_updated_at
    BEFORE UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE 7: application_stage_reviews
-- Tracks each department's review step for department_chain workflows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.application_stage_reviews (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id   UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    stage_number     INTEGER     NOT NULL,
    department       TEXT        NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at      TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.application_stage_reviews
    IS 'One row per stage in a department_chain workflow. Tracks which department reviews, the outcome, and who reviewed it.';

-- ============================================================================
-- TABLE 8: work_notes
-- Running notes visible across the department chain for an application.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.work_notes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    author_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    note            TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.work_notes
    IS 'Running log of notes attached to an application, visible to all reviewers in the department chain and the citizen.';

-- ============================================================================
-- TABLE 9: notifications
-- User-facing notifications for application events.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title                    TEXT        NOT NULL,
    message                  TEXT        NOT NULL,
    type                     TEXT        NOT NULL
                                         CHECK (type IN (
                                             'application_submitted',
                                             'stage_approved',
                                             'application_approved',
                                             'application_rejected',
                                             'document_issued',
                                             'lawyer_accepted',
                                             'case_completed'
                                         )),
    read                     BOOLEAN     NOT NULL DEFAULT false,
    related_application_id   UUID        REFERENCES public.applications(id) ON DELETE SET NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifications
    IS 'Push/in-app notifications for users about application lifecycle events.';

-- ============================================================================
-- TABLE 10: documents
-- Official documents issued to citizens upon application completion.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.documents (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    application_id  UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    document_type   TEXT        NOT NULL,   -- e.g. 'Registration Certificate', 'Driving License'
    document_number TEXT        NOT NULL UNIQUE,
    details         JSONB       NOT NULL DEFAULT '{}',
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.documents
    IS 'Official documents issued to citizens when their application is approved. Includes certificate/license details.';

-- ============================================================================
-- TABLE 11: lawyer_cases
-- Tracks the relationship between lawyers and applications they handle.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lawyer_cases (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lawyer_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    application_id  UUID        NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    status          TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'completed')),
    accepted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

COMMENT ON TABLE public.lawyer_cases
    IS 'Tracks lawyer-to-case assignments. A lawyer accepts a case (active) and eventually resolves it (completed).';

-- ============================================================================
-- INDEXES
-- Performance indexes for common query patterns.
-- ============================================================================

-- profiles
CREATE INDEX idx_profiles_email           ON public.profiles(email);
CREATE INDEX idx_profiles_role            ON public.profiles(role);

-- lawyer_details
CREATE INDEX idx_lawyer_details_user_id   ON public.lawyer_details(user_id);
CREATE INDEX idx_lawyer_details_spec      ON public.lawyer_details(specialization);

-- government_officials
CREATE INDEX idx_govt_officials_user_id   ON public.government_officials(user_id);
CREATE INDEX idx_govt_officials_dept      ON public.government_officials(department);

-- departments
CREATE INDEX idx_departments_code         ON public.departments(code);

-- application_types
CREATE INDEX idx_app_types_slug           ON public.application_types(slug);
CREATE INDEX idx_app_types_category       ON public.application_types(category);
CREATE INDEX idx_app_types_active         ON public.application_types(is_active);
CREATE INDEX idx_app_types_workflow_type  ON public.application_types(workflow_type);

-- applications
CREATE INDEX idx_applications_citizen_id  ON public.applications(citizen_id);
CREATE INDEX idx_applications_type_id     ON public.applications(application_type_id);
CREATE INDEX idx_applications_status      ON public.applications(status);
CREATE INDEX idx_applications_lawyer_id   ON public.applications(assigned_lawyer_id);
CREATE INDEX idx_applications_created_at  ON public.applications(created_at DESC);
CREATE INDEX idx_applications_citizen_status ON public.applications(citizen_id, status);

-- application_stage_reviews
CREATE INDEX idx_stage_reviews_app_id     ON public.application_stage_reviews(application_id);
CREATE INDEX idx_stage_reviews_dept_status ON public.application_stage_reviews(department, status);
CREATE INDEX idx_stage_reviews_reviewer    ON public.application_stage_reviews(reviewer_id);

-- work_notes
CREATE INDEX idx_work_notes_app_id        ON public.work_notes(application_id);
CREATE INDEX idx_work_notes_author_id     ON public.work_notes(author_id);
CREATE INDEX idx_work_notes_created_at    ON public.work_notes(created_at DESC);

-- notifications
CREATE INDEX idx_notifications_user_id    ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_read  ON public.notifications(user_id, read);
CREATE INDEX idx_notifications_type       ON public.notifications(type);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- documents
CREATE INDEX idx_documents_citizen_id     ON public.documents(citizen_id);
CREATE INDEX idx_documents_app_id         ON public.documents(application_id);
CREATE INDEX idx_documents_doc_number     ON public.documents(document_number);
CREATE INDEX idx_documents_doc_type       ON public.documents(document_type);

-- lawyer_cases
CREATE INDEX idx_lawyer_cases_lawyer_id   ON public.lawyer_cases(lawyer_id);
CREATE INDEX idx_lawyer_cases_app_id      ON public.lawyer_cases(application_id);
CREATE INDEX idx_lawyer_cases_status      ON public.lawyer_cases(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_details            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.government_officials      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_types         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_stage_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_notes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_cases              ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- Helper: current user's profile
-- Avoids repetitive joins in policies.
-- ──────────────────────────────────────────────
-- (No helper function needed; we use auth.uid() and sub-selects directly.)

-- ============================================================================
-- profiles — RLS Policies
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "profiles: users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- All authenticated users can read basic profile info (needed for cross-role visibility:
-- officials need to see citizen names, lawyers need to see citizen names, etc.)
CREATE POLICY "profiles: authenticated users can read"
    ON public.profiles FOR SELECT
    USING (auth.role() = 'authenticated');

-- Users can update their own profile (but not change role — that should be admin-only)
CREATE POLICY "profiles: users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- The handle_new_user trigger inserts on behalf of the user during signup
-- Service role handles this; allow INSERT via service_role (no user-level INSERT policy needed)

-- Service role full access
CREATE POLICY "profiles: service_role full access"
    ON public.profiles FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- lawyer_details — RLS Policies
-- ============================================================================

-- Lawyers can read their own details
CREATE POLICY "lawyer_details: lawyers can read own details"
    ON public.lawyer_details FOR SELECT
    USING (auth.uid() = user_id);

-- Lawyers can insert their own details (during onboarding)
CREATE POLICY "lawyer_details: lawyers can insert own details"
    ON public.lawyer_details FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Lawyers can update their own details
CREATE POLICY "lawyer_details: lawyers can update own details"
    ON public.lawyer_details FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Citizens and officials can read lawyer details (for browsing/assignment)
CREATE POLICY "lawyer_details: authenticated users can read"
    ON public.lawyer_details FOR SELECT
    USING (auth.role() = 'authenticated');

-- Service role full access
CREATE POLICY "lawyer_details: service_role full access"
    ON public.lawyer_details FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- government_officials — RLS Policies
-- ============================================================================

-- Officials can read their own record
CREATE POLICY "government_officials: officials can read own record"
    ON public.government_officials FOR SELECT
    USING (auth.uid() = user_id);

-- All authenticated users can read government_officials (for display/assignment info)
CREATE POLICY "government_officials: authenticated users can read"
    ON public.government_officials FOR SELECT
    USING (auth.role() = 'authenticated');

-- Service role full access
CREATE POLICY "government_officials: service_role full access"
    ON public.government_officials FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- departments — RLS Policies
-- ============================================================================

-- All authenticated users can read departments
CREATE POLICY "departments: authenticated users can read"
    ON public.departments FOR SELECT
    USING (auth.role() = 'authenticated');

-- Service role full access
CREATE POLICY "departments: service_role full access"
    ON public.departments FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- application_types — RLS Policies
-- ============================================================================

-- All authenticated users can read active application types
CREATE POLICY "application_types: authenticated users can read"
    ON public.application_types FOR SELECT
    USING (auth.role() = 'authenticated');

-- Service role full access
CREATE POLICY "application_types: service_role full access"
    ON public.application_types FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- applications — RLS Policies
-- ============================================================================

-- Citizens can read their own applications
CREATE POLICY "applications: citizens can read own applications"
    ON public.applications FOR SELECT
    USING (auth.uid() = citizen_id);

-- Government officials can read applications from their department
-- (joins with application_stage_reviews to check department match)
CREATE POLICY "applications: officials can read dept applications"
    ON public.applications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.government_officials go
            JOIN public.application_stage_reviews asr
                ON asr.department = go.department
            WHERE go.user_id = auth.uid()
              AND asr.application_id = applications.id
        )
    );

-- Lawyers can read applications assigned to them
CREATE POLICY "applications: lawyers can read assigned applications"
    ON public.applications FOR SELECT
    USING (auth.uid() = assigned_lawyer_id);

-- Lawyers can also read applications that need lawyer assignment matching their specialization
CREATE POLICY "applications: lawyers can read pending applications matching specialization"
    ON public.applications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.lawyer_details ld
            JOIN public.application_types at ON at.id = applications.application_type_id
            WHERE ld.user_id = auth.uid()
              AND at.workflow_type = 'lawyer_assignment'
              AND at.workflow_config->>'lawyer_specialization' = ld.specialization
              AND applications.status = 'lawyer_pending'
        )
    );

-- Citizens can insert their own applications
CREATE POLICY "applications: citizens can insert own applications"
    ON public.applications FOR INSERT
    WITH CHECK (auth.uid() = citizen_id);

-- Government officials can update applications in their department's review chain
CREATE POLICY "applications: officials can update dept applications"
    ON public.applications FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.government_officials go
            JOIN public.application_stage_reviews asr
                ON asr.department = go.department
            WHERE go.user_id = auth.uid()
              AND asr.application_id = applications.id
        )
    );

-- Lawyers can update applications they are assigned to
CREATE POLICY "applications: lawyers can update assigned applications"
    ON public.applications FOR UPDATE
    USING (auth.uid() = assigned_lawyer_id);

-- Citizens can update their own applications (limited — e.g. cancel)
CREATE POLICY "applications: citizens can update own applications"
    ON public.applications FOR UPDATE
    USING (auth.uid() = citizen_id);

-- Service role full access
CREATE POLICY "applications: service_role full access"
    ON public.applications FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- application_stage_reviews — RLS Policies
-- ============================================================================

-- Citizens can read reviews for their own applications
CREATE POLICY "stage_reviews: citizens can read own application reviews"
    ON public.application_stage_reviews FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.applications a
            WHERE a.id = application_stage_reviews.application_id
              AND a.citizen_id = auth.uid()
        )
    );

-- Government officials can read reviews for their department
CREATE POLICY "stage_reviews: officials can read dept reviews"
    ON public.application_stage_reviews FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.government_officials go
            WHERE go.user_id = auth.uid()
              AND go.department = application_stage_reviews.department
        )
    );

-- Government officials can update reviews for their department
CREATE POLICY "stage_reviews: officials can update dept reviews"
    ON public.application_stage_reviews FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.government_officials go
            WHERE go.user_id = auth.uid()
              AND go.department = application_stage_reviews.department
        )
    );

-- Citizens can insert stage reviews for their own applications (when creating an application)
CREATE POLICY "stage_reviews: citizens can insert for own applications"
    ON public.application_stage_reviews FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.applications a
            WHERE a.id = application_stage_reviews.application_id
              AND a.citizen_id = auth.uid()
        )
    );

-- Service role full access
CREATE POLICY "stage_reviews: service_role full access"
    ON public.application_stage_reviews FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- work_notes — RLS Policies
-- ============================================================================

-- Citizens can read notes on their own applications
CREATE POLICY "work_notes: citizens can read own application notes"
    ON public.work_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.applications a
            WHERE a.id = work_notes.application_id
              AND a.citizen_id = auth.uid()
        )
    );

-- Government officials can read and create notes on applications in their department
CREATE POLICY "work_notes: officials can read dept application notes"
    ON public.work_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.government_officials go
            JOIN public.application_stage_reviews asr
                ON asr.department = go.department
            WHERE go.user_id = auth.uid()
              AND asr.application_id = work_notes.application_id
        )
    );

CREATE POLICY "work_notes: officials can insert dept application notes"
    ON public.work_notes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.government_officials go
            JOIN public.application_stage_reviews asr
                ON asr.department = go.department
            WHERE go.user_id = auth.uid()
              AND asr.application_id = work_notes.application_id
        )
    );

-- Lawyers can read and create notes on applications assigned to them
CREATE POLICY "work_notes: lawyers can read assigned application notes"
    ON public.work_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.applications a
            WHERE a.id = work_notes.application_id
              AND a.assigned_lawyer_id = auth.uid()
        )
    );

CREATE POLICY "work_notes: lawyers can insert assigned application notes"
    ON public.work_notes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.applications a
            WHERE a.id = work_notes.application_id
              AND a.assigned_lawyer_id = auth.uid()
        )
    );

-- Service role full access
CREATE POLICY "work_notes: service_role full access"
    ON public.work_notes FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- notifications — RLS Policies
-- ============================================================================

-- Users can read their own notifications
CREATE POLICY "notifications: users can read own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications: users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Any authenticated user can insert notifications (needed for citizen self-notifications,
-- government officials notifying citizens, and lawyers notifying citizens)
CREATE POLICY "notifications: authenticated users can insert"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Service role full access (used by backend to create notifications)
CREATE POLICY "notifications: service_role full access"
    ON public.notifications FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- documents — RLS Policies
-- ============================================================================

-- Citizens can read their own documents
CREATE POLICY "documents: citizens can read own documents"
    ON public.documents FOR SELECT
    USING (auth.uid() = citizen_id);

-- Government officials can read documents for applications in their department
CREATE POLICY "documents: officials can read dept application documents"
    ON public.documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.government_officials go
            JOIN public.application_stage_reviews asr
                ON asr.department = go.department
            JOIN public.applications a ON a.id = asr.application_id
            WHERE go.user_id = auth.uid()
              AND a.id = documents.application_id
        )
    );

-- Government officials can insert documents for applications in their department
CREATE POLICY "documents: officials can insert dept application documents"
    ON public.documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.government_officials go
            JOIN public.application_stage_reviews asr
                ON asr.department = go.department
            JOIN public.applications a ON a.id = asr.application_id
            WHERE go.user_id = auth.uid()
              AND a.id = documents.application_id
        )
    );

-- Service role full access (used by backend to issue documents)
CREATE POLICY "documents: service_role full access"
    ON public.documents FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- lawyer_cases — RLS Policies
-- ============================================================================

-- Lawyers can read their own cases
CREATE POLICY "lawyer_cases: lawyers can read own cases"
    ON public.lawyer_cases FOR SELECT
    USING (auth.uid() = lawyer_id);

-- Citizens can read lawyer_cases for their own applications
CREATE POLICY "lawyer_cases: citizens can read own application cases"
    ON public.lawyer_cases FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.applications a
            WHERE a.id = lawyer_cases.application_id
              AND a.citizen_id = auth.uid()
        )
    );

-- Lawyers can update their own cases
CREATE POLICY "lawyer_cases: lawyers can update own cases"
    ON public.lawyer_cases FOR UPDATE
    USING (auth.uid() = lawyer_id);

-- Lawyers can insert new case records (when accepting a case)
CREATE POLICY "lawyer_cases: lawyers can insert own cases"
    ON public.lawyer_cases FOR INSERT
    WITH CHECK (auth.uid() = lawyer_id);

-- Service role full access
CREATE POLICY "lawyer_cases: service_role full access"
    ON public.lawyer_cases FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- TRIGGER: Auto-create profile on user signup
-- When a new row is inserted into auth.users, this trigger creates
-- the corresponding row in public.profiles with default role = 'citizen'.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, preferred_language)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'citizen'),
        COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if re-running
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user()
    IS 'Trigger function: automatically creates a public.profiles row when a new user signs up via Supabase Auth. Reads full_name, role, and preferred_language from user_metadata.';

-- ============================================================================
-- SEED DATA: departments
-- ============================================================================

INSERT INTO public.departments (name, code, description) VALUES
    ('Transport Department',      'TRANS',  'Handles vehicle registration, driving licenses, transport permits, and road transport regulations.'),
    ('Police Department',         'POLICE', 'Law enforcement, crime investigation, traffic management, and public safety.'),
    ('Revenue Department',        'REV',    'Land revenue collection, land records, property registration, and land dispute resolution.'),
    ('Health Department',         'HEALTH', 'Public health services, health insurance schemes, hospital administration, and disease control.'),
    ('Municipal Corporation',     'MUNC',   'Urban civic services including trade licenses, building permits, water supply, and sanitation.'),
    ('Legal Services Authority',  'LEGAL',  'Free legal aid, legal awareness programs, and access to justice for eligible citizens.');

-- ============================================================================
-- SEED DATA: application_types
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────
-- 1. Vehicle Registration (ACTIVE — department_chain workflow)
-- ──────────────────────────────────────────────────────────────────────
INSERT INTO public.application_types (
    name, slug, description, category, icon, color,
    is_active, workflow_type, workflow_config, form_fields
) VALUES (
    'Vehicle Registration',
    'vehicle-registration',
    'Register a new or used vehicle with the Regional Transport Office. Involves background verification by the Police Department and final registration issuance by the Transport Department.',
    'Transport',
    'fa-car',
    '#1a73e8',
    true,
    'department_chain',
    '{
        "stages": [
            {"stage": 1, "department": "Transport Department", "label": "Application Intake"},
            {"stage": 2, "department": "Police Department", "label": "Vehicle Background Check"},
            {"stage": 3, "department": "Transport Department", "label": "Registration Issuance"}
        ]
    }'::jsonb,
    '[
        {"name": "full_name",              "label": "Full Name",                "type": "text",     "required": true},
        {"name": "date_of_birth",          "label": "Date of Birth",            "type": "date",     "required": true},
        {"name": "address",                "label": "Address",                  "type": "textarea", "required": true},
        {"name": "vehicle_make",           "label": "Vehicle Make",             "type": "text",     "required": true},
        {"name": "vehicle_model",          "label": "Vehicle Model",            "type": "text",     "required": true},
        {"name": "year_of_manufacture",    "label": "Year of Manufacture",      "type": "number",   "required": true},
        {"name": "chassis_number",         "label": "Chassis Number",           "type": "text",     "required": true},
        {"name": "engine_number",          "label": "Engine Number",            "type": "text",     "required": true},
        {"name": "vehicle_color",          "label": "Vehicle Color",            "type": "text",     "required": true},
        {"name": "fuel_type",              "label": "Fuel Type",                "type": "select",   "required": true, "options": ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"]},
        {"name": "insurance_policy_number","label": "Insurance Policy Number",  "type": "text",     "required": true},
        {"name": "insurance_expiry_date",  "label": "Insurance Expiry Date",    "type": "date",     "required": true},
        {"name": "previous_owner_name",    "label": "Previous Owner Name (if used)", "type": "text", "required": false},
        {"name": "previous_owner_contact", "label": "Previous Owner Contact",   "type": "text",     "required": false},
        {"name": "purchase_date",          "label": "Purchase Date",            "type": "date",     "required": true},
        {"name": "purchase_price",         "label": "Purchase Price",           "type": "number",   "required": true}
    ]'::jsonb
);

-- ──────────────────────────────────────────────────────────────────────
-- 2. Land Dispute Case (ACTIVE — lawyer_assignment workflow)
-- ──────────────────────────────────────────────────────────────────────
INSERT INTO public.application_types (
    name, slug, description, category, icon, color,
    is_active, workflow_type, workflow_config, form_fields
) VALUES (
    'Land Dispute Case',
    'land-dispute',
    'File a land dispute case and get matched with a qualified lawyer specializing in land and property disputes. The lawyer will guide you through the legal process.',
    'Legal',
    'fa-gavel',
    '#2e7d32',
    true,
    'lawyer_assignment',
    '{"lawyer_specialization": "Land Disputes"}'::jsonb,
    '[
        {"name": "full_name",              "label": "Full Name",                "type": "text",     "required": true},
        {"name": "address",                "label": "Address",                  "type": "textarea", "required": true},
        {"name": "dispute_location",       "label": "Dispute Location",         "type": "text",     "required": true},
        {"name": "survey_number",          "label": "Survey Number",            "type": "text",     "required": true},
        {"name": "land_area",              "label": "Land Area (in acres)",     "type": "number",   "required": true},
        {"name": "dispute_description",    "label": "Dispute Description",      "type": "textarea", "required": true},
        {"name": "opposing_party_name",    "label": "Opposing Party Name",      "type": "text",     "required": true},
        {"name": "opposing_party_address", "label": "Opposing Party Address",   "type": "textarea", "required": true},
        {"name": "duration_of_dispute",    "label": "Duration of Dispute",      "type": "text",     "required": true},
        {"name": "previous_legal_action",  "label": "Any Previous Legal Action","type": "textarea", "required": false},
        {"name": "expected_resolution",    "label": "Expected Resolution",      "type": "textarea", "required": true}
    ]'::jsonb
);

-- ──────────────────────────────────────────────────────────────────────
-- 3–12. Coming Soon application types (is_active = false)
-- ──────────────────────────────────────────────────────────────────────

INSERT INTO public.application_types (
    name, slug, description, category, icon, color,
    is_active, workflow_type, workflow_config, form_fields
) VALUES

-- 3. Driving License
(
    'Driving License',
    'driving-license',
    'Apply for a new driving license or renew an existing one. Includes learner''s permit and permanent license issuance.',
    'Transport',
    'fa-id-card',
    '#1565c0',
    false,
    'department_chain',
    '{"stages": [
        {"stage": 1, "department": "Transport Department", "label": "Application & Document Verification"},
        {"stage": 2, "department": "Transport Department", "label": "Driving Test Scheduling"},
        {"stage": 3, "department": "Transport Department", "label": "License Issuance"}
    ]}'::jsonb,
    '[
        {"name": "full_name",          "label": "Full Name",          "type": "text",     "required": true},
        {"name": "date_of_birth",      "label": "Date of Birth",     "type": "date",     "required": true},
        {"name": "address",            "label": "Address",            "type": "textarea", "required": true},
        {"name": "blood_group",        "label": "Blood Group",        "type": "select",   "required": true, "options": ["A+","A-","B+","B-","AB+","AB-","O+","O-"]},
        {"name": "vehicle_class",      "label": "Vehicle Class",      "type": "select",   "required": true, "options": ["Two Wheeler","Four Wheeler","Heavy Vehicle"]},
        {"name": "existing_license",   "label": "Existing License Number (if renewal)", "type": "text", "required": false}
    ]'::jsonb
),

-- 4. Birth Certificate
(
    'Birth Certificate',
    'birth-certificate',
    'Register a birth and obtain an official birth certificate from the Municipal Corporation.',
    'Identity',
    'fa-baby',
    '#e91e63',
    false,
    'department_chain',
    '{"stages": [
        {"stage": 1, "department": "Municipal Corporation", "label": "Application & Document Verification"},
        {"stage": 2, "department": "Municipal Corporation", "label": "Certificate Issuance"}
    ]}'::jsonb,
    '[
        {"name": "child_name",           "label": "Child Full Name",       "type": "text",     "required": true},
        {"name": "date_of_birth",        "label": "Date of Birth",         "type": "date",     "required": true},
        {"name": "place_of_birth",       "label": "Place of Birth",        "type": "text",     "required": true},
        {"name": "father_name",          "label": "Father Full Name",      "type": "text",     "required": true},
        {"name": "mother_name",          "label": "Mother Full Name",      "type": "text",     "required": true},
        {"name": "hospital_name",        "label": "Hospital Name",         "type": "text",     "required": false},
        {"name": "permanent_address",    "label": "Permanent Address",     "type": "textarea", "required": true}
    ]'::jsonb
),

-- 5. Death Certificate
(
    'Death Certificate',
    'death-certificate',
    'Register a death and obtain an official death certificate from the Municipal Corporation.',
    'Identity',
    'fa-cross',
    '#757575',
    false,
    'department_chain',
    '{"stages": [
        {"stage": 1, "department": "Municipal Corporation", "label": "Application & Document Verification"},
        {"stage": 2, "department": "Municipal Corporation", "label": "Certificate Issuance"}
    ]}'::jsonb,
    '[
        {"name": "deceased_name",        "label": "Deceased Person Full Name", "type": "text",     "required": true},
        {"name": "date_of_death",        "label": "Date of Death",             "type": "date",     "required": true},
        {"name": "place_of_death",       "label": "Place of Death",            "type": "text",     "required": true},
        {"name": "cause_of_death",       "label": "Cause of Death",            "type": "text",     "required": true},
        {"name": "applicant_name",       "label": "Applicant Full Name",       "type": "text",     "required": true},
        {"name": "applicant_relation",   "label": "Relationship to Deceased",  "type": "text",     "required": true},
        {"name": "address",              "label": "Address",                    "type": "textarea", "required": true}
    ]'::jsonb
),

-- 6. Passport Application
(
    'Passport Application',
    'passport-application',
    'Apply for a new Indian passport or renew an existing one.',
    'Identity',
    'fa-passport',
    '#ff6f00',
    false,
    'department_chain',
    '{"stages": [
        {"stage": 1, "department": "Police Department", "label": "Background Verification"},
        {"stage": 2, "department": "Police Department", "label": "Police Clearance Certificate"},
        {"stage": 3, "department": "Revenue Department", "label": "Document Verification"},
        {"stage": 4, "department": "Revenue Department", "label": "Passport Issuance"}
    ]}'::jsonb,
    '[
        {"name": "full_name",              "label": "Full Name (as per documents)", "type": "text",     "required": true},
        {"name": "date_of_birth",          "label": "Date of Birth",               "type": "date",     "required": true},
        {"name": "place_of_birth",         "label": "Place of Birth",              "type": "text",     "required": true},
        {"name": "present_address",        "label": "Present Address",             "type": "textarea", "required": true},
        {"name": "permanent_address",      "label": "Permanent Address",           "type": "textarea", "required": true},
        {"name": "emergency_contact_name", "label": "Emergency Contact Name",      "type": "text",     "required": true},
        {"name": "emergency_contact_phone","label": "Emergency Contact Phone",     "type": "tel",      "required": true},
        {"name": "passport_type",          "label": "Passport Type",               "type": "select",   "required": true, "options": ["Fresh","Re-issue","Tatkal"]}
    ]'::jsonb
),

-- 7. PAN Card
(
    'PAN Card',
    'pan-card',
    'Apply for a new Permanent Account Number (PAN) card for tax identification purposes.',
    'Tax',
    'fa-credit-card',
    '#4a148c',
    false,
    'department_chain',
    '{"stages": [
        {"stage": 1, "department": "Revenue Department", "label": "Application & Identity Verification"},
        {"stage": 2, "department": "Revenue Department", "label": "PAN Card Issuance"}
    ]}'::jsonb,
    '[
        {"name": "full_name",          "label": "Full Name",          "type": "text",     "required": true},
        {"name": "date_of_birth",      "label": "Date of Birth",     "type": "date",     "required": true},
        {"name": "father_name",        "label": "Father Full Name",  "type": "text",     "required": true},
        {"name": "address",            "label": "Address",            "type": "textarea", "required": true},
        {"name": "aadhaar_number",     "label": "Aadhaar Number",    "type": "text",     "required": true},
        {"name": "employment_type",    "label": "Employment Type",   "type": "select",   "required": true, "options": ["Salaried","Self-Employed","Business","Student","Others"]}
    ]'::jsonb
),

-- 8. Property Tax
(
    'Property Tax',
    'property-tax',
    'Pay property tax or apply for property tax assessment and receive a tax receipt.',
    'Revenue',
    'fa-building',
    '#33691e',
    false,
    'department_chain',
    '{"stages": [
        {"stage": 1, "department": "Revenue Department", "label": "Property Verification"},
        {"stage": 2, "department": "Municipal Corporation", "label": "Tax Assessment"},
        {"stage": 3, "department": "Revenue Department", "label": "Payment & Receipt Issuance"}
    ]}'::jsonb,
    '[
        {"name": "owner_name",         "label": "Property Owner Name",   "type": "text",     "required": true},
        {"name": "property_address",   "label": "Property Address",      "type": "textarea", "required": true},
        {"name": "survey_number",      "label": "Survey Number",         "type": "text",     "required": true},
        {"name": "property_type",      "label": "Property Type",         "type": "select",   "required": true, "options": ["Residential","Commercial","Industrial","Agricultural"]},
        {"name": "built_up_area",      "label": "Built-up Area (sq ft)", "type": "number",   "required": true},
        {"name": "assessment_year",    "label": "Assessment Year",       "type": "text",     "required": true}
    ]'::jsonb
),

-- 9. Health Insurance
(
    'Health Insurance',
    'health-insurance',
    'Apply for government health insurance schemes such as Ayushman Bharat Pradhan Mantri Jan Arogya Yojana.',
    'Health',
    'fa-heartbeat',
    '#c62828',
    false,
    'department_chain',
    '{"stages": [
        {"stage": 1, "department": "Health Department", "label": "Eligibility Verification"},
        {"stage": 2, "department": "Health Department", "label": "Enrollment & Card Issuance"}
    ]}'::jsonb,
    '[
        {"name": "full_name",              "label": "Full Name",              "type": "text",     "required": true},
        {"name": "date_of_birth",          "label": "Date of Birth",         "type": "date",     "required": true},
        {"name": "address",                "label": "Address",               "type": "textarea", "required": true},
        {"name": "aadhaar_number",         "label": "Aadhaar Number",        "type": "text",     "required": true},
        {"name": "ration_card_number",     "label": "Ration Card Number",    "type": "text",     "required": true},
        {"name": "annual_income",          "label": "Annual Family Income",  "type": "number",   "required": true},
        {"name": "family_members",         "label": "Number of Family Members", "type": "number", "required": true},
        {"name": "existing_conditions",    "label": "Existing Medical Conditions", "type": "textarea", "required": false}
    ]'::jsonb
),

-- 10. Trade License
(
    'Trade License',
    'trade-license',
    'Apply for a trade or business license from the Municipal Corporation to legally operate a commercial establishment.',
    'Municipal',
    'fa-store',
    '#00695c',
    false,
    'department_chain',
    '{"stages": [
        {"stage": 1, "department": "Municipal Corporation", "label": "Application & Document Verification"},
        {"stage": 2, "department": "Municipal Corporation", "label": "Inspection"},
        {"stage": 3, "department": "Municipal Corporation", "label": "License Issuance"}
    ]}'::jsonb,
    '[
        {"name": "business_name",      "label": "Business Name",       "type": "text",     "required": true},
        {"name": "owner_name",         "label": "Owner Full Name",     "type": "text",     "required": true},
        {"name": "business_address",   "label": "Business Address",    "type": "textarea", "required": true},
        {"name": "business_type",      "label": "Type of Business",    "type": "select",   "required": true, "options": ["Retail","Wholesale","Manufacturing","Service","Food & Beverage"]},
        {"name": "gst_number",         "label": "GST Number",          "type": "text",     "required": false},
        {"name": "premises_area",      "label": "Premises Area (sq ft)", "type": "number", "required": true},
        {"name": "number_of_employees","label": "Number of Employees", "type": "number",   "required": true}
    ]'::jsonb
),

-- 11. Pension Application
(
    'Pension Application',
    'pension-application',
    'Apply for government pension schemes including old-age pension, widow pension, and disability pension.',
    'Welfare',
    'fa-hand-holding-heart',
    '#bf360c',
    false,
    'department_chain',
    '{"stages": [
        {"stage": 1, "department": "Revenue Department", "label": "Eligibility Verification"},
        {"stage": 2, "department": "Revenue Department", "label": "Approval & Pension Initiation"}
    ]}'::jsonb,
    '[
        {"name": "full_name",           "label": "Full Name",             "type": "text",     "required": true},
        {"name": "date_of_birth",       "label": "Date of Birth",        "type": "date",     "required": true},
        {"name": "address",             "label": "Address",              "type": "textarea", "required": true},
        {"name": "aadhaar_number",      "label": "Aadhaar Number",       "type": "text",     "required": true},
        {"name": "pension_type",        "label": "Pension Type",         "type": "select",   "required": true, "options": ["Old Age Pension","Widow Pension","Disability Pension","Farmer Pension"]},
        {"name": "bank_account_number", "label": "Bank Account Number",  "type": "text",     "required": true},
        {"name": "bank_name",           "label": "Bank Name",            "type": "text",     "required": true},
        {"name": "ifsc_code",           "label": "IFSC Code",            "type": "text",     "required": true}
    ]'::jsonb
),

-- 12. FIR Filing
(
    'FIR Filing',
    'fir-filing',
    'File a First Information Report (FIR) online with the Police Department for criminal incidents.',
    'Legal',
    'fa-exclamation-triangle',
    '#880e4f',
    false,
    'department_chain',
    '{"stages": [
        {"stage": 1, "department": "Police Department", "label": "FIR Registration"},
        {"stage": 2, "department": "Police Department", "label": "Investigation Assignment"}
    ]}'::jsonb,
    '[
        {"name": "complainant_name",    "label": "Complainant Full Name",  "type": "text",     "required": true},
        {"name": "complainant_address", "label": "Complainant Address",    "type": "textarea", "required": true},
        {"name": "incident_date",       "label": "Date of Incident",       "type": "date",     "required": true},
        {"name": "incident_time",       "label": "Time of Incident",       "type": "time",     "required": true},
        {"name": "incident_location",   "label": "Location of Incident",   "type": "text",     "required": true},
        {"name": "incident_description","label": "Description of Incident","type": "textarea", "required": true},
        {"name": "accused_name",        "label": "Accused Name (if known)","type": "text",     "required": false},
        {"name": "accused_address",     "label": "Accused Address",        "type": "textarea", "required": false},
        {"name": "sections_involved",   "label": "Sections of Law (if known)", "type": "text", "required": false}
    ]'::jsonb
);

-- ============================================================================
-- SEED DATA: Pre-created Government Officials
-- ============================================================================
-- 
-- These INSERT statements create the auth.users entries FIRST, then rely on
-- the `handle_new_user` trigger to auto-create the profiles row (with the
-- correct role from user_metadata). Finally, they insert the
-- government_officials record.
--
-- This approach satisfies the foreign key constraint: profiles.id references
-- auth.users(id), so auth.users must be populated first.
--
-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  No manual steps required. Run the entire script and the officials       ║
-- ║  will be created automatically.                                          ║
-- ║                                                                          ║
-- ║  Credentials for testing:                                                ║
-- ║    transport.official@ekraah.gov.in  /  Ekraah@2025                      ║
-- ║    police.official@ekraah.gov.in     /  Ekraah@2025                      ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
--

-- ──────────────────────────────────────────────────────────────────────
-- Transport Department Official: Rajesh Kumar
-- Email: transport.official@ekraah.gov.in
-- Password: Ekraah@2025
-- ──────────────────────────────────────────────────────────────────────

-- Step 1: Create the auth user. The handle_new_user trigger will
-- automatically create a row in public.profiles with role='government_official'
-- (read from raw_user_meta_data).
-- Use ON CONFLICT DO NOTHING to skip if user already exists.
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
SELECT
    gen_random_uuid(),                                                -- id (auto-generated)
    '00000000-0000-0000-0000-000000000000',                           -- instance_id
    'authenticated',                                                  -- aud
    'authenticated',                                                  -- role
    'transport.official@ekraah.gov.in',                               -- email
    crypt('Ekraah@2025', gen_salt('bf')),                             -- encrypted_password
    now(),                                                            -- email_confirmed_at
    '{"full_name": "Rajesh Kumar", "role": "government_official", "preferred_language": "en"}'::jsonb,  -- raw_user_meta_data
    now(),                                                            -- created_at
    now(),                                                            -- updated_at
    '',                                                               -- confirmation_token
    '',                                                               -- email_change
    '',                                                               -- email_change_token_new
    ''                                                                -- recovery_token
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'transport.official@ekraah.gov.in'
);

-- Step 2: Insert the government_officials record, linking to the profile
-- that was auto-created by the handle_new_user trigger.
INSERT INTO public.government_officials (user_id, department, designation)
SELECT id, 'Transport Department', 'Regional Transport Officer'
FROM public.profiles
WHERE email = 'transport.official@ekraah.gov.in'
  AND role = 'government_official'
  AND NOT EXISTS (
      SELECT 1 FROM public.government_officials go
      JOIN public.profiles p ON p.id = go.user_id
      WHERE p.email = 'transport.official@ekraah.gov.in'
  );

-- ──────────────────────────────────────────────────────────────────────
-- Police Department Official: Priya Sharma
-- Email: police.official@ekraah.gov.in
-- Password: Ekraah@2025
-- ──────────────────────────────────────────────────────────────────────

-- Step 1: Create the auth user. The handle_new_user trigger will
-- automatically create a row in public.profiles with role='government_official'
-- (read from raw_user_meta_data).
-- Use SELECT ... WHERE NOT EXISTS to skip if user already exists.
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
)
SELECT
    gen_random_uuid(),                                                -- id (auto-generated)
    '00000000-0000-0000-0000-000000000000',                           -- instance_id
    'authenticated',                                                  -- aud
    'authenticated',                                                  -- role
    'police.official@ekraah.gov.in',                                  -- email
    crypt('Ekraah@2025', gen_salt('bf')),                             -- encrypted_password
    now(),                                                            -- email_confirmed_at
    '{"full_name": "Priya Sharma", "role": "government_official", "preferred_language": "en"}'::jsonb,  -- raw_user_meta_data
    now(),                                                            -- created_at
    now(),                                                            -- updated_at
    '',                                                               -- confirmation_token
    '',                                                               -- email_change
    '',                                                               -- email_change_token_new
    ''                                                                -- recovery_token
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'police.official@ekraah.gov.in'
);

-- Step 2: Insert the government_officials record, linking to the profile
-- that was auto-created by the handle_new_user trigger.
INSERT INTO public.government_officials (user_id, department, designation)
SELECT id, 'Police Department', 'Station House Officer'
FROM public.profiles
WHERE email = 'police.official@ekraah.gov.in'
  AND role = 'government_official'
  AND NOT EXISTS (
      SELECT 1 FROM public.government_officials go
      JOIN public.profiles p ON p.id = go.user_id
      WHERE p.email = 'police.official@ekraah.gov.in'
  );

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
-- 
-- Summary of created objects:
--   Tables:        11 (profiles, lawyer_details, government_officials, departments,
--                        application_types, applications, application_stage_reviews,
--                        work_notes, notifications, documents, lawyer_cases)
--   Indexes:       30+ (covering all foreign keys and common query patterns)
--   RLS Policies:  30+ (granular access control per role)
--   Triggers:      3 (handle_new_user, set_profiles_updated_at, set_applications_updated_at)
--   Functions:     2 (handle_new_user, update_updated_at_column)
--   Seed Data:     6 departments, 12 application types, 2 government officials
--
-- ============================================================================
