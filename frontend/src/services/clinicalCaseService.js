import axios from 'axios';

const API_URL = '/api/clinical-cases';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listClinicalCases(patientId) {
  const res = await axios.get(`${API_URL}/patients/${patientId}/cases`, { headers: getAuthHeaders() });
  return res.data;
}

export async function createClinicalCase(patientId, data) {
  const res = await axios.post(`${API_URL}/patients/${patientId}/cases`, data, { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } });
  return res.data;
}

export async function getClinicalCase(caseId) {
  const res = await axios.get(`${API_URL}/cases/${caseId}`, { headers: getAuthHeaders() });
  return res.data;
}

export async function updateClinicalCase(caseId, data) {
  const res = await axios.put(`${API_URL}/cases/${caseId}`, data, { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } });
  return res.data;
}

export async function deleteClinicalCase(caseId) {
  const res = await axios.delete(`${API_URL}/cases/${caseId}`, { headers: getAuthHeaders() });
  return res.data;
}

export async function listCaseMedicalRecords(caseId) {
  const res = await axios.get(`${API_URL}/cases/${caseId}/medical-records`, { headers: getAuthHeaders() });
  return res.data;
}

export async function createCaseMedicalRecord(caseId, data) {
  const res = await axios.post(`${API_URL}/cases/${caseId}/medical-records`, data, { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } });
  return res.data;
}

export default {
  listClinicalCases,
  createClinicalCase,
  getClinicalCase,
  updateClinicalCase,
  deleteClinicalCase,
  listCaseMedicalRecords,
  createCaseMedicalRecord,
}; 