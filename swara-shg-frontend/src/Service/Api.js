import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login:                    (credentials) => api.post('/auth/login', credentials),
  register:                 (userData)    => api.post('/auth/register', userData),
  getCurrentUser:           ()            => api.get('/auth/me'),
  changePassword:           (passwords)   => api.post('/auth/change-password', passwords),
  changeFirstPassword:      (data)        => api.post('/auth/change-first-password', data),
  forgotPassword:           (data)        => api.post('/auth/forgot-password', data),
  resetPassword:            (data)        => api.post('/auth/reset-password', data),
  adminResetMemberPassword: (memberId)    => api.post('/auth/admin-reset-password', { memberId }),
};

// Members API
export const membersAPI = {
  getAll:          ()               => api.get('/members'),
  getById:         (id)             => api.get(`/members/${id}`),
  getDashboard:    (id)             => api.get(`/members/${id}/dashboard`),
  create:          (memberData)     => api.post('/members', memberData),
  update:          (id, memberData) => api.put(`/members/${id}`, memberData),
  deactivate:      (id)             => api.delete(`/members/${id}`),
  deletePermanent: (id)             => api.delete(`/members/${id}/permanent`),
};

// Savings API
export const savingsAPI = {
  getAll:          (params)          => api.get('/savings', { params }),
  getByMember:     (memberId)        => api.get(`/savings/member/${memberId}`),
  getMonthlyReport:(month, year)     => api.get(`/savings/report/${month}/${year}`),
  getStats:        (params = {})     => api.get('/savings/stats', { params }),
  create:          (savingsData)     => api.post('/savings', savingsData),
  update:          (id, savingsData) => api.put(`/savings/${id}`, savingsData),
  delete:          (id)              => api.delete(`/savings/${id}`),
};

// Loans API
export const loansAPI = {
  getAll:                    (params)                    => api.get('/loans', { params }),
  getById:                   (id)                        => api.get(`/loans/${id}`),
  getGuaranteedLoans:        (memberId)                  => api.get(`/loans/guaranteed/${memberId}`),
  getDurationOptions:        (amount)                    => api.get('/loans/duration-options', { params: { amount } }),
  getOfficeGuarantor:        ()                          => api.get('/loans/office-guarantor'),
  getStatistics:             (params = {})               => api.get('/loans/stats/summary', { params }),
  apply:                     (loanData)                  => api.post('/loans/apply', loanData),
  updateLoan:                (loanId, loanData)          => api.put(`/loans/${loanId}`, loanData),
  approveLoan:               (loanId)                    => api.post(`/loans/${loanId}/approve`),
  rejectLoan:                (loanId, reason)            => api.post(`/loans/${loanId}/reject`, { reason }),
  deleteLoan:                (loanId)                    => api.delete(`/loans/${loanId}`),
  recordPayment:             (paymentData)               => api.post('/loans/payment', paymentData),
  updateStatuses:            ()                          => api.post('/loans/update-statuses'),
  getMyGuarantorRequests:    ()                          => api.get('/loans/my-guarantor-requests'),
  respondToGuarantorRequest: (guarantorId, response, reason) =>
    api.post(`/loans/guarantor-requests/${guarantorId}/respond`, { response, reason }),
  getLoanGuarantorStatus:    (loanId)                    => api.get(`/loans/${loanId}/guarantor-status`),
  replaceGuarantor:          (loanId, data)              => api.post(`/loans/${loanId}/replace-guarantor`, data),
  checkEligibility:          (memberId)                  => api.get(`/loans/eligibility/${memberId}`),
  requestTopUp:              (topUpData)                 => api.post('/loans/top-up', topUpData),
  getMaxLoan:                (memberId)                  => api.get(`/loans/max-loan/${memberId}`),
};

// Notifications API
export const notificationsAPI = {
  getAll:             ()   => api.get('/notifications'),
  getUnreadCount:     ()   => api.get('/notifications/unread-count'),
  markAsRead:         (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead:      ()   => api.put('/notifications/read-all'),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
};

// Chamaa API
export const chamaaAPI = {
  getAllCycles:               (params)               => api.get('/chamaa', { params }),
  getCycleById:              (id)                   => api.get(`/chamaa/${id}`),
  getMonthlyReport:          (cycleId, month, year) => api.get(`/chamaa/report/${cycleId}/${month}/${year}`),
  createCycle:               (cycleData)            => api.post('/chamaa', cycleData),
  addParticipant:            (participantData)      => api.post('/chamaa/participant', participantData),
  updateParticipantPosition: (id, newPosition)      => api.put(`/chamaa/participant/${id}/position`, { newPosition }),
  updateParticipantSchedule: (id, data)             => api.put(`/chamaa/participant/${id}/schedule`, data),
  recordContribution:        (contributionData)     => api.post('/chamaa/contribution', contributionData),
  markAsReceived:            (receivedData)         => api.post('/chamaa/received', receivedData),
  endCycle:                  (id)                   => api.put(`/chamaa/${id}/end`),
};

// Deposits API
export const depositsAPI = {
  createWithDistribution: (data)        => api.post('/deposits', data),
  getSummary:             (memberId)    => api.get(`/deposits/summary/${memberId}`),
  getAll:                 (params)      => api.get('/deposits', { params }),
  getPending:             (params = {}) => api.get('/deposits', {
    params: { depositStatus: 'pending_confirmation', ...params },
  }),
  approveDeposit: (id)       => api.post(`/deposits/${id}/approve`),
  rejectDeposit:  (id, data) => api.post(`/deposits/${id}/reject`, data),
  updateDeposit:  (id, data) => api.put(`/deposits/${id}`, data),
};

// Fines API
export const finesAPI = {
  getAll:   (params)      => api.get('/fines', { params }),
  getStats: (params = {}) => api.get('/fines/stats', { params }),
  create:   (data)        => api.post('/fines', data),
  markPaid: (id)          => api.put(`/fines/${id}/pay`),
  delete:   (id)          => api.delete(`/fines/${id}`),
};

// ── Seed Capital API ─────────────────────────────────────────────────────────
export const seedCapitalAPI = {
  getStats: ()         => api.get('/seed-capital/stats'),
  getAll:   ()         => api.get('/seed-capital'),
  create:   (data)     => api.post('/seed-capital', data),
  update:   (id, data) => api.put(`/seed-capital/${id}`, data),
  delete:   (id)       => api.delete(`/seed-capital/${id}`),
};

// Guarantor Eligibility API
export const guarantorsAPI = {
  getEligible:      (params)              => api.get('/guarantors/eligible', { params }),
  checkEligibility: (guarantorId, params) => api.get(`/guarantors/${guarantorId}/check-eligibility`, { params }),
};

// AGM Fee API
export const agmFeeAPI = {
  getStats: (year) => api.get('/agm-fees/stats', { params: { year } }),
  getAll:   (year) => api.get('/agm-fees',        { params: { year } }),
  create:   (data) => api.post('/agm-fees', data),
  delete:   (id)   => api.delete(`/agm-fees/${id}`),
};

// Statutory API
export const statutoryAPI = {
  getAll:  (year)           => api.get('/statutory',                     { params: { year } }),
  save:    (memberId, data) => api.put(`/statutory/${memberId}`,         data),
  submit:  (memberId, data) => api.post(`/statutory/${memberId}/submit`, data),
};

// Investment API
export const investmentAPI = {
  getAll:   (year) => api.get(`/investments?year=${year}`),
  save:     (data) => api.post('/investments/save', data),
  getStats: (year) => api.get(`/investments/stats?year=${year}`),
};

// Registration Fee API
export const registrationFeeAPI = {
  getAll:   ()            => api.get('/registration-fees'),
  getStats: (params = {}) => api.get('/registration-fees/stats', { params }),
  save:     (data)        => api.post('/registration-fees', data),
  delete:   (memberId)    => api.delete(`/registration-fees/${memberId}`),
};

// Admins API
export const adminsAPI = {
  getAll:        ()                => api.get('/admins'),
  create:        (data)            => api.post('/admins', data),
  resetPassword: (id, newPassword) => api.put(`/admins/${id}/reset-password`, { newPassword }),
  toggleActive:  (id)              => api.put(`/admins/${id}/toggle-active`),
  delete:        (id)              => api.delete(`/admins/${id}`),
};

export default api;