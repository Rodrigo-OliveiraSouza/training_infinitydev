const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || 'Request failed';
    throw new Error(message);
  }
  return data;
}

const api = {
  request,
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  recover: (payload) =>
    request('/auth/recover', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  markIntroSeen: () => request('/auth/me/intro', { method: 'PATCH' }),
  updateProfile: (payload) =>
    request('/auth/me/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
  setLanguage: (languageId) =>
    request('/auth/me/language', { method: 'PATCH', body: JSON.stringify({ languageId }) }),
  languages: () => request('/languages'),
  levelsByLanguage: (languageId, classId) =>
    request(`/languages/${languageId}/levels${classId ? `?classId=${classId}` : ''}`),
  level: (levelId) => request(`/levels/${levelId}`),
  startLevel: (levelId) => request(`/levels/${levelId}/start`, { method: 'POST' }),
  run: (levelId, payload) =>
    request(`/levels/${levelId}/run`, { method: 'POST', body: JSON.stringify(payload) }),
  submit: (levelId, payload) =>
    request(`/levels/${levelId}/submit`, { method: 'POST', body: JSON.stringify(payload) }),
  leaderboardLevel: (levelId) => request(`/leaderboard/levels/${levelId}`),
  leaderboardGlobal: (languageId) =>
    request(`/leaderboard/global${languageId ? `?languageId=${languageId}` : ''}`),
  progress: () => request('/progress'),
  resetOwnLevelProgress: (levelId) => request(`/progress/levels/${levelId}/reset`, { method: 'POST' }),
  adminLevels: (languageId) => request(`/admin/levels?languageId=${languageId}`),
  adminLevelCreate: (payload) => request('/admin/levels', { method: 'POST', body: JSON.stringify(payload) }),
  adminLevelUpdate: (levelId, payload) =>
    request(`/admin/levels/${levelId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  adminLevelDelete: (levelId) => request(`/admin/levels/${levelId}`, { method: 'DELETE' }),
  adminUsers: (query = '') =>
    request(`/admin/users${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  adminUpdateUser: (userId, payload) =>
    request(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  adminUserLevels: (userId, languageId) =>
    request(`/admin/users/${userId}/levels${languageId ? `?languageId=${languageId}` : ''}`),
  adminResetUserLevel: (userId, levelId) =>
    request(`/admin/users/${userId}/reset-level`, {
      method: 'POST',
      body: JSON.stringify({ levelId })
    }),
  adminResetUserAll: (userId) => request(`/admin/users/${userId}/reset-all`, { method: 'POST' }),
  adminCertificateTracks: () => request('/admin/certificates'),
  adminCertificateCreate: (payload) =>
    request('/admin/certificates', { method: 'POST', body: JSON.stringify(payload) }),
  adminCertificateUpdate: (trackId, payload) =>
    request(`/admin/certificates/${trackId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  adminCertificateOrders: () => request('/admin/certificates/orders/list'),
  adminCertificateMarkPaid: (orderId) =>
    request(`/admin/certificates/orders/${orderId}/mark-paid`, { method: 'POST' }),
  rewardsItems: () => request('/rewards/items'),
  rewardsPurchase: (rewardKey) =>
    request('/rewards/purchase', { method: 'POST', body: JSON.stringify({ rewardKey }) }),
  rewardsEquip: (rewardKey) =>
    request('/rewards/equip', { method: 'POST', body: JSON.stringify({ rewardKey }) }),
  classes: () => request('/classes'),
  joinClass: (code) => request('/classes/join', { method: 'POST', body: JSON.stringify({ code }) }),
  createClass: (payload) => request('/classes', { method: 'POST', body: JSON.stringify(payload) }),
  classLeaderboardLevel: (classId, levelId) =>
    request(`/leaderboard/classes/${classId}/levels/${levelId}`),
  classLeaderboardGlobal: (classId, languageId) =>
    request(`/leaderboard/classes/${classId}/global${languageId ? `?languageId=${languageId}` : ''}`),
  teacherClasses: () => request('/teacher/classes'),
  teacherClassLevels: (classId, languageId) =>
    request(`/teacher/classes/${classId}/levels${languageId ? `?languageId=${languageId}` : ''}`),
  teacherCreateLevel: (classId, payload) =>
    request(`/teacher/classes/${classId}/levels`, { method: 'POST', body: JSON.stringify(payload) }),
  teacherUpdateLevel: (classId, levelId, payload) =>
    request(`/teacher/classes/${classId}/levels/${levelId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  teacherDeleteLevel: (classId, levelId) =>
    request(`/teacher/classes/${classId}/levels/${levelId}`, { method: 'DELETE' }),
  certificates: () => request('/certificates'),
  certificateSubmitFinalActivity: (trackId, submissionText) =>
    request(`/certificates/${trackId}/submit-final-activity`, {
      method: 'POST',
      body: JSON.stringify({ submissionText })
    }),
  certificateRequestPayment: (trackId, paymentMethod) =>
    request(`/certificates/${trackId}/payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod })
    }),
  certificateRender: (trackId, mode = 'preview') =>
    request(`/certificates/${trackId}/render?mode=${encodeURIComponent(mode)}`)
};

export { api, getToken, setToken };

