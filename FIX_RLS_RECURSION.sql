-- ============================================================
-- ekRAAH - Fix RLS Recursion (v7 - drops ALL leftover policies)
-- ============================================================

-- ══════════════════════════════════════════════
-- PHASE 1: Drop ALL function-dependent policies
-- (includes leftover policies from previous attempts)
-- ══════════════════════════════════════════════

-- applications
DROP POLICY IF EXISTS "applications: officials can read dept applications" ON public.applications;
DROP POLICY IF EXISTS "applications: officials can update dept applications" ON public.applications;
DROP POLICY IF EXISTS "applications: lawyers can read assigned applications" ON public.applications;
DROP POLICY IF EXISTS "applications: lawyers can read pending applications matching specialization" ON public.applications;
DROP POLICY IF EXISTS "applications: lawyers can update assigned applications" ON public.applications;
DROP POLICY IF EXISTS "Officials can view dept applications" ON public.applications;
DROP POLICY IF EXISTS "Dept reviewers can update applications" ON public.applications;

-- application_stage_reviews
DROP POLICY IF EXISTS "stage_reviews: citizens can read own application reviews" ON public.application_stage_reviews;
DROP POLICY IF EXISTS "stage_reviews: officials can read dept reviews" ON public.application_stage_reviews;
DROP POLICY IF EXISTS "stage_reviews: officials can update dept reviews" ON public.application_stage_reviews;
DROP POLICY IF EXISTS "stage_reviews: citizens can insert for own applications" ON public.application_stage_reviews;
DROP POLICY IF EXISTS "Department reviewers can view stage reviews" ON public.application_stage_reviews;
DROP POLICY IF EXISTS "Department reviewers can update stage reviews" ON public.application_stage_reviews;

-- work_notes
DROP POLICY IF EXISTS "work_notes: citizens can read own application notes" ON public.work_notes;
DROP POLICY IF EXISTS "work_notes: officials can read dept application notes" ON public.work_notes;
DROP POLICY IF EXISTS "work_notes: officials can insert dept application notes" ON public.work_notes;
DROP POLICY IF EXISTS "work_notes: lawyers can read assigned application notes" ON public.work_notes;
DROP POLICY IF EXISTS "work_notes: lawyers can insert assigned application notes" ON public.work_notes;

-- documents
DROP POLICY IF EXISTS "documents: officials can read dept application documents" ON public.documents;
DROP POLICY IF EXISTS "documents: officials can insert dept application documents" ON public.documents;

-- lawyer_cases
DROP POLICY IF EXISTS "lawyer_cases: citizens can read own application cases" ON public.lawyer_cases;

-- ══════════════════════════════════════════════
-- PHASE 2: Drop ALL 5 helper functions (no CASCADE needed now)
-- ══════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.is_application_citizen(UUID);
DROP FUNCTION IF EXISTS public.is_dept_official(TEXT);
DROP FUNCTION IF EXISTS public.is_assigned_lawyer(UUID);
DROP FUNCTION IF EXISTS public.is_matching_lawyer(UUID);
DROP FUNCTION IF EXISTS public.is_dept_reviewer(UUID);

-- ══════════════════════════════════════════════
-- PHASE 3: Recreate ALL 5 functions with SECURITY DEFINER
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_application_citizen(app_id UUID)
RETURNS BOOLEAN AS $$     SELECT EXISTS (
        SELECT 1 FROM public.applications WHERE id = app_id AND citizen_id = auth.uid()
    )
 $$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_dept_official(dept TEXT)
RETURNS BOOLEAN AS $$     SELECT EXISTS (
        SELECT 1 FROM public.government_officials WHERE user_id = auth.uid() AND department = dept
    )
 $$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_assigned_lawyer(app_id UUID)
RETURNS BOOLEAN AS $$     SELECT EXISTS (
        SELECT 1 FROM public.applications WHERE id = app_id AND assigned_lawyer_id = auth.uid()
    )
 $$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_matching_lawyer(app_id UUID)
RETURNS BOOLEAN AS $$     SELECT EXISTS (
        SELECT 1 FROM public.lawyer_details ld
        JOIN public.application_types at ON at.workflow_type = 'lawyer_assignment'
            AND at.workflow_config->>'lawyer_specialization' = ld.specialization
        JOIN public.applications a ON a.application_type_id = at.id AND a.status = 'lawyer_pending'
        WHERE ld.user_id = auth.uid() AND a.id = app_id
    )
 $$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_dept_reviewer(app_id UUID)
RETURNS BOOLEAN AS $$     SELECT EXISTS (
        SELECT 1 FROM public.government_officials go
        JOIN public.application_stage_reviews asr ON asr.department = go.department
        WHERE go.user_id = auth.uid() AND asr.application_id = app_id
    )
 $$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ══════════════════════════════════════════════
-- PHASE 4: Grant execute on all functions
-- ══════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.is_application_citizen(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_dept_official(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigned_lawyer(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_matching_lawyer(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_dept_reviewer(UUID) TO anon, authenticated;

-- ══════════════════════════════════════════════
-- PHASE 5: Recreate ALL policies (original schema names)
-- ══════════════════════════════════════════════

-- ── applications ──
CREATE POLICY "applications: officials can read dept applications"
    ON public.applications FOR SELECT
    USING (public.is_dept_reviewer(id));

CREATE POLICY "applications: lawyers can read assigned applications"
    ON public.applications FOR SELECT
    USING (public.is_assigned_lawyer(id));

CREATE POLICY "applications: lawyers can read pending applications matching specialization"
    ON public.applications FOR SELECT
    USING (public.is_matching_lawyer(id));

CREATE POLICY "applications: officials can update dept applications"
    ON public.applications FOR UPDATE
    USING (public.is_dept_reviewer(id));

CREATE POLICY "applications: lawyers can update assigned applications"
    ON public.applications FOR UPDATE
    USING (public.is_assigned_lawyer(id));

-- ── application_stage_reviews ──
CREATE POLICY "stage_reviews: citizens can read own application reviews"
    ON public.application_stage_reviews FOR SELECT
    USING (public.is_application_citizen(application_id));

CREATE POLICY "stage_reviews: officials can read dept reviews"
    ON public.application_stage_reviews FOR SELECT
    USING (public.is_dept_official(department));

CREATE POLICY "stage_reviews: officials can update dept reviews"
    ON public.application_stage_reviews FOR UPDATE
    USING (public.is_dept_official(department));

CREATE POLICY "stage_reviews: citizens can insert for own applications"
    ON public.application_stage_reviews FOR INSERT
    WITH CHECK (public.is_application_citizen(application_id));

-- ── work_notes ──
CREATE POLICY "work_notes: citizens can read own application notes"
    ON public.work_notes FOR SELECT
    USING (public.is_application_citizen(application_id));

CREATE POLICY "work_notes: officials can read dept application notes"
    ON public.work_notes FOR SELECT
    USING (public.is_dept_reviewer(application_id));

CREATE POLICY "work_notes: officials can insert dept application notes"
    ON public.work_notes FOR INSERT
    WITH CHECK (public.is_dept_reviewer(application_id));

CREATE POLICY "work_notes: lawyers can read assigned application notes"
    ON public.work_notes FOR SELECT
    USING (public.is_assigned_lawyer(application_id));

CREATE POLICY "work_notes: lawyers can insert assigned application notes"
    ON public.work_notes FOR INSERT
    WITH CHECK (public.is_assigned_lawyer(application_id));

-- ── documents ──
CREATE POLICY "documents: officials can read dept application documents"
    ON public.documents FOR SELECT
    USING (public.is_dept_reviewer(application_id));

CREATE POLICY "documents: officials can insert dept application documents"
    ON public.documents FOR INSERT
    WITH CHECK (public.is_dept_reviewer(application_id));

-- ── lawyer_cases ──
CREATE POLICY "lawyer_cases: citizens can read own application cases"
    ON public.lawyer_cases FOR SELECT
    USING (public.is_application_citizen(application_id));

-- ══════════════════════════════════════════════
-- PHASE 6: Verify
-- ══════════════════════════════════════════════

SELECT
    proname AS function_name,
    prosecdef AS is_security_definer
FROM pg_proc
WHERE proname IN (
    'is_application_citizen',
    'is_dept_official',
    'is_assigned_lawyer',
    'is_matching_lawyer',
    'is_dept_reviewer'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');