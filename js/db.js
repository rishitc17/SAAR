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
        lawyer_profile:assigned_lawyer_id (full_name)
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
    try {
      const { data, error } = await window.EkraahDB
        .from('applications')
        .select('*, application_types (name, slug, icon, color)')
        .in('status', ['submitted', 'in_review'])
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('ekRAAH: getDepartmentApplications query failed:', error.message);
        return [];
      }

      // Filter to only those with pending review for this department at the CURRENT stage
      const filtered = [];
      for (const app of (data || [])) {
        const { data: reviews } = await window.EkraahDB
          .from('application_stage_reviews')
          .select('stage_number')
          .eq('application_id', app.id)
          .eq('department', department)
          .eq('status', 'pending');
        if (reviews && reviews.length > 0) {
          // Only include if any pending review stage matches the app's current stage
          const pendingStages = reviews.map(r => r.stage_number);
          if (pendingStages.includes(app.current_stage)) {
            filtered.push(app);
          }
        }
      }
      return filtered;
    } catch (err) {
      console.warn('ekRAAH: getDepartmentApplications error:', err.message);
      return [];
    }
  }

  async function getDepartmentAppsSimple(department) {
    // Get applications where current stage has a pending review for this department
    // This avoids duplicates when the same department appears at multiple stages
    try {
      // 1. Get pending stage reviews for this department
      const { data: reviews, error: revError } = await window.EkraahDB
        .from('application_stage_reviews')
        .select('application_id, stage_number')
        .eq('department', department)
        .eq('status', 'pending');
      if (revError) {
        console.warn('ekRAAH: getDepartmentAppsSimple stage_reviews query failed:', revError.message);
        return [];
      }

      if (!reviews || reviews.length === 0) return [];

      // 2. Get the applications to check their current_stage
      const appIds = [...new Set(reviews.map(r => r.application_id))];
      const { data: apps, error: appError } = await window.EkraahDB
        .from('applications')
        .select('*, application_types (name, slug, icon, color)')
        .in('id', appIds)
        .order('created_at', { ascending: false });
      if (appError) {
        console.warn('ekRAAH: getDepartmentAppsSimple applications query failed:', appError.message);
        return [];
      }

      // 3. Filter: only include apps where the current_stage matches a pending review for this dept
      const reviewMap = {};
      reviews.forEach(r => {
        if (!reviewMap[r.application_id]) reviewMap[r.application_id] = [];
        reviewMap[r.application_id].push(r.stage_number);
      });

      const filtered = (apps || []).filter(app => {
        const pendingStages = reviewMap[app.id] || [];
        return pendingStages.includes(app.current_stage);
      });

      return filtered;
    } catch (err) {
      console.warn('ekRAAH: getDepartmentAppsSimple error:', err.message);
      return [];
    }
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
      .select('*, profiles:author_id (full_name, role)')
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
    // Check if already accepted (prevent duplicates)
    const { data: existing, error: existErr } = await window.EkraahDB
      .from('lawyer_cases')
      .select('id, status')
      .eq('application_id', applicationId)
      .limit(1);

    if (existing && existing.length > 0) {
      // Already accepted — just return, don't create duplicate
      console.warn('Case already accepted, skipping duplicate entry.');
      return existing[0];
    }

    // Update application with assigned lawyer
    const { data: app, error: updateErr } = await window.EkraahDB
      .from('applications')
      .update({
        assigned_lawyer_id: lawyerId,
        status: 'lawyer_assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (updateErr) {
      console.error('Error updating application for case acceptance:', updateErr);
      throw updateErr;
    }

    if (!app) {
      throw new Error('Failed to assign case — application update returned no data (possible RLS restriction).');
    }

    // Create lawyer_case entry (with duplicate guard)
    const { data: existingAgain } = await window.EkraahDB
      .from('lawyer_cases')
      .select('id')
      .eq('application_id', applicationId)
      .limit(1);

    if (!existingAgain || existingAgain.length === 0) {
      const { error: insertErr } = await window.EkraahDB
        .from('lawyer_cases')
        .insert({
          lawyer_id: lawyerId,
          application_id: applicationId,
          status: 'active'
        });

      if (insertErr) {
        console.error('Error inserting lawyer_case:', insertErr);
        throw insertErr;
      }
    }

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
    // Get counts for the department — counting unique applications, not stage reviews
    try {
      const { data: reviews, error } = await window.EkraahDB
        .from('application_stage_reviews')
        .select('status, application_id, stage_number')
        .eq('department', department);

      if (error) {
        console.warn('ekRAAH: getDashboardStats query failed:', error.message);
        return { pending: 0, approved: 0, rejected: 0, total: 0, avgProcessingDays: 0 };
      }

      // Group by application_id to count unique applications
      const appMap = {};
      (reviews || []).forEach(r => {
        if (!appMap[r.application_id]) {
          appMap[r.application_id] = { statuses: [], stages: [] };
        }
        appMap[r.application_id].statuses.push(r.status);
        appMap[r.application_id].stages.push(r);
      });

      const uniqueAppIds = Object.keys(appMap);
      const total = uniqueAppIds.length;

      // Pending: apps where at least one review for this dept is pending AND the current stage matches
      // For simplicity, count apps where any review is still pending
      let pending = 0;
      let approved = 0;
      let rejected = 0;

      uniqueAppIds.forEach(appId => {
        const appReviews = appMap[appId];
        if (appReviews.statuses.includes('pending')) {
          pending++;
        } else if (appReviews.statuses.every(s => s === 'approved')) {
          approved++;
        } else if (appReviews.statuses.includes('rejected')) {
          rejected++;
        }
      });

      // Calculate average processing time from approved reviews
      let avgProcessingDays = 0;
      const { data: approvedReviews } = await window.EkraahDB
        .from('application_stage_reviews')
        .select('created_at, reviewed_at')
        .eq('department', department)
        .eq('status', 'approved')
        .not('reviewed_at', 'is', null);

      if (approvedReviews && approvedReviews.length > 0) {
        const totalDays = approvedReviews.reduce((sum, r) => {
          const created = new Date(r.created_at);
          const reviewed = new Date(r.reviewed_at);
          const days = (reviewed - created) / (1000 * 60 * 60 * 24);
          return sum + Math.max(0, days);
        }, 0);
        avgProcessingDays = (totalDays / approvedReviews.length).toFixed(1);
      }

      return { pending, approved, rejected, total, avgProcessingDays };
    } catch (err) {
      console.warn('ekRAAH: getDashboardStats error:', err.message);
      return { pending: 0, approved: 0, rejected: 0, total: 0, avgProcessingDays: 0 };
    }
  }

  async function getAllApplicationsCount() {
    const { count } = await window.EkraahDB
      .from('applications')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  }

  // ============ Realtime Subscriptions ============
  // Track active channels to prevent duplicate subscriptions
  const activeChannels = {};

  function subscribeToNotifications(userId, callback) {
    // Prevent duplicate subscriptions — Supabase throws if .on() is called
    // on a channel that's already subscribed
    const channelName = 'notifications:' + userId;
    if (activeChannels[channelName]) {
      return activeChannels[channelName];
    }

    const channel = window.EkraahDB
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, payload => {
        callback(payload.new);
      })
      .subscribe();

    activeChannels[channelName] = channel;
    return channel;
  }

  function unsubscribeAllNotifications() {
    Object.keys(activeChannels).forEach(name => {
      window.EkraahDB.removeChannel(activeChannels[name]);
      delete activeChannels[name];
    });
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
    subscribeToNotifications,
    unsubscribeAllNotifications
  };
})();

window.EkraahDBHelpers = EkraahDB;
