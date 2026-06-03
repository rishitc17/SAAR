/**
 * ekRAAH - Database Helper Functions
 */

const EkraahDB = (() => {
  const db = () => window.EkraahDB;

  // ============ Notifications ============
  async function getNotifications(userId) {
    const { data, error } = await window.EkraahDB
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function markNotificationRead(notifId) {
    const { data, error } = await window.EkraahDB
      .from('notifications')
      .update({ read: true })
      .eq('id', notifId);
    if (error) throw error;
    return data;
  }

  async function markAllNotificationsRead(userId) {
    const { data, error } = await window.EkraahDB
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (error) throw error;
    return data;
  }

  async function createNotification(userId, title, message, type, relatedAppId = null) {
    const { data, error } = await window.EkraahDB
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        related_application_id: relatedAppId
      });
    if (error) console.error('Error creating notification:', error);
    return data;
  }

  // ============ Applications ============
  async function createApplication(citizenId, typeId, formData, totalStages, status = 'submitted') {
    const { data, error } = await window.EkraahDB
      .from('applications')
      .insert({
        citizen_id: citizenId,
        application_type_id: typeId,
        form_data: formData,
        status,
        current_stage: 1,
        total_stages: totalStages
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function getApplicationById(appId) {
    const { data, error } = await window.EkraahDB
      .from('applications')
      .select(`
        *,
        application_types (*),
        application_stage_reviews (*),
        work_notes (*, profiles:author_id (full_name, role)),
        lawyer_details:assigned_lawyer_id (full_name:profiles(full_name))
      `)
      .eq('id', appId)
      .single();
    if (error) throw error;
    return data;
  }

  async function getCitizenApplications(citizenId) {
    const { data, error } = await window.EkraahDB
      .from('applications')
      .select('*, application_types (name, slug, icon, color)')
      .eq('citizen_id', citizenId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getDepartmentApplications(department) {
    // Get applications where current stage review is pending for this department
    const { data, error } = await window.EkraahDB
      .from('applications')
      .select('*, application_types (name, slug, icon, color)')
      .contains('status', ['submitted', 'in_review'])
      .order('created_at', { ascending: false });
    if (error) throw error;
    
    // Filter to only those with pending review for this department
    const filtered = [];
    for (const app of (data || [])) {
      const { data: reviews } = await window.EkraahDB
        .from('application_stage_reviews')
        .select('*')
        .eq('application_id', app.id)
        .eq('department', department)
        .eq('status', 'pending');
      if (reviews && reviews.length > 0) {
        filtered.push(app);
      }
    }
    return filtered;
  }

  async function getDepartmentAppsSimple(department) {
    // Get all active applications and filter by department stage reviews
    const { data, error } = await window.EkraahDB
      .from('application_stage_reviews')
      .select('application_id')
      .eq('department', department)
      .eq('status', 'pending');
    if (error) throw error;
    
    if (!data || data.length === 0) return [];
    
    const appIds = data.map(r => r.application_id);
    const { data: apps } = await window.EkraahDB
      .from('applications')
      .select('*, application_types (name, slug, icon, color)')
      .in('id', appIds)
      .order('created_at', { ascending: false });
    return apps || [];
  }

  async function updateApplicationStatus(appId, status, currentStage) {
    const { data, error } = await window.EkraahDB
      .from('applications')
      .update({ status, current_stage: currentStage, updated_at: new Date().toISOString() })
      .eq('id', appId);
    if (error) throw error;
    return data;
  }

  // ============ Stage Reviews ============
  async function createStageReviews(applicationId, stages) {
    const reviews = stages.map(s => ({
      application_id: applicationId,
      stage_number: s.stage,
      department: s.department,
      status: 'pending'
    }));
    const { data, error } = await window.EkraahDB
      .from('application_stage_reviews')
      .insert(reviews);
    if (error) throw error;
    return data;
  }

  async function approveStage(reviewId, reviewerId) {
    const { data, error } = await window.EkraahDB
      .from('application_stage_reviews')
      .update({
        status: 'approved',
        reviewer_id: reviewerId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', reviewId);
    if (error) throw error;
    return data;
  }

  async function rejectStage(reviewId, reviewerId, reason) {
    const { data, error } = await window.EkraahDB
      .from('application_stage_reviews')
      .update({
        status: 'rejected',
        reviewer_id: reviewerId,
        rejection_reason: reason,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', reviewId);
    if (error) throw error;
    return data;
  }

  async function getStageReviews(applicationId) {
    const { data, error } = await window.EkraahDB
      .from('application_stage_reviews')
      .select('*')
      .eq('application_id', applicationId)
      .order('stage_number', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // ============ Work Notes ============
  async function addWorkNote(applicationId, authorId, note) {
    const { data, error } = await window.EkraahDB
      .from('work_notes')
      .insert({
        application_id: applicationId,
        author_id: authorId,
        note
      });
    if (error) throw error;
    return data;
  }

  async function getWorkNotes(applicationId) {
    const { data, error } = await window.EkraahDB
      .from('work_notes')
      .select('*, profiles:author_id (full_name, role, government_officials(department))')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // ============ Documents ============
  async function getDocuments(citizenId) {
    const { data, error } = await window.EkraahDB
      .from('documents')
      .select('*, applications (*, application_types (name, slug, icon, color))')
      .eq('citizen_id', citizenId)
      .order('issued_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function issueDocument(citizenId, applicationId, docType, details = {}) {
    const docNumber = docType.substring(0, 3).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
    const { data, error } = await window.EkraahDB
      .from('documents')
      .insert({
        citizen_id: citizenId,
        application_id: applicationId,
        document_type: docType,
        document_number: docNumber,
        details
      });
    if (error) throw error;
    return data;
  }

  // ============ Lawyer Cases ============
  async function getAvailableCases(specialization) {
    // Get land dispute cases that are pending lawyer assignment
    const { data: appTypes } = await window.EkraahDB
      .from('application_types')
      .select('id')
      .eq('workflow_type', 'lawyer_assignment');
    
    if (!appTypes || appTypes.length === 0) return [];
    
    const typeIds = appTypes.map(t => t.id);
    
    const { data, error } = await window.EkraahDB
      .from('applications')
      .select('*, application_types (name, slug, icon, color, workflow_config)')
      .in('application_type_id', typeIds)
      .eq('status', 'lawyer_pending')
      .is('assigned_lawyer_id', null);
    
    if (error) throw error;
    
    // Filter by specialization match
    const filtered = (data || []).filter(app => {
      const config = app.application_types?.workflow_config;
      if (!config) return true;
      return !config.lawyer_specialization || 
             config.lawyer_specialization === specialization ||
             specialization === 'Land Disputes';
    });
    return filtered;
  }

  async function acceptCase(lawyerId, applicationId) {
    // Update application with assigned lawyer
    const { data: app } = await window.EkraahDB
      .from('applications')
      .update({ 
        assigned_lawyer_id: lawyerId, 
        status: 'lawyer_assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select()
      .single();
    
    // Create lawyer_case entry
    await window.EkraahDB
      .from('lawyer_cases')
      .insert({
        lawyer_id: lawyerId,
        application_id: applicationId,
        status: 'active'
      });
    
    return app;
  }

  async function completeCase(lawyerId, applicationId) {
    await window.EkraahDB
      .from('lawyer_cases')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      })
      .eq('lawyer_id', lawyerId)
      .eq('application_id', applicationId);
    
    await window.EkraahDB
      .from('applications')
      .update({ 
        status: 'completed', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', applicationId);
  }

  async function getLawyerCases(lawyerId) {
    const { data, error } = await window.EkraahDB
      .from('lawyer_cases')
      .select('*, applications (*, application_types (name, slug, icon, color), profiles:citizen_id (full_name, email))')
      .eq('lawyer_id', lawyerId)
      .order('accepted_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // ============ Application Types ============
  async function getApplicationTypes() {
    const { data, error } = await window.EkraahDB
      .from('application_types')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function getActiveApplicationTypes() {
    const { data, error } = await window.EkraahDB
      .from('application_types')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function getApplicationTypeBySlug(slug) {
    const { data, error } = await window.EkraahDB
      .from('application_types')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error) throw error;
    return data;
  }

  // ============ Analytics ============
  async function getDashboardStats(department) {
    // Get counts for the department
    const { data: reviews } = await window.EkraahDB
      .from('application_stage_reviews')
      .select('status, application_id')
      .eq('department', department);
    
    const pending = (reviews || []).filter(r => r.status === 'pending').length;
    const approved = (reviews || []).filter(r => r.status === 'approved').length;
    const rejected = (reviews || []).filter(r => r.status === 'rejected').length;
    
    return { pending, approved, rejected, total: reviews?.length || 0 };
  }

  async function getAllApplicationsCount() {
    const { count } = await window.EkraahDB
      .from('applications')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  }

  // ============ Realtime Subscriptions ============
  function subscribeToNotifications(userId, callback) {
    return window.EkraahDB
      .channel('notifications:' + userId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, payload => {
        callback(payload.new);
      })
      .subscribe();
  }

  return {
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    createNotification,
    createApplication,
    getApplicationById,
    getCitizenApplications,
    getDepartmentAppsSimple,
    updateApplicationStatus,
    createStageReviews,
    approveStage,
    rejectStage,
    getStageReviews,
    addWorkNote,
    getWorkNotes,
    getDocuments,
    issueDocument,
    getAvailableCases,
    acceptCase,
    completeCase,
    getLawyerCases,
    getApplicationTypes,
    getActiveApplicationTypes,
    getApplicationTypeBySlug,
    getDashboardStats,
    getAllApplicationsCount,
    subscribeToNotifications
  };
})();

window.EkraahDBHelpers = EkraahDB;
