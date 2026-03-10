// src/services/medicalService.js

import axios from 'axios';

const API_URL = '/api/doctors';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getMedicalRecords(patientId, params = {}) {
  console.log('=== FRONTEND: getMedicalRecords ===');
  console.log('patientId:', patientId);
  console.log('params:', params);
  console.log('clinicalCaseId en params:', params.clinicalCaseId);
  console.log('=== FIN FRONTEND ===');
  
  const response = await axios.get(`${API_URL}/patients/${patientId}/medical-records`, {
    headers: getAuthHeaders(),
    params,
  });
  return response.data;
}

export async function getMedicalRecordById(patientId, recordId) {
  const response = await axios.get(`${API_URL}/patients/${patientId}/medical-records/${recordId}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function createMedicalRecord(patientId, data) {
  console.log('createMedicalRecord - patientId:', patientId);
  console.log('createMedicalRecord - data:', data, typeof data);
  const response = await axios.post(`${API_URL}/patients/${patientId}/medical-records`, data, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
  });
  return response.data;
}

export async function updateMedicalRecord(patientId, recordId, data) {
  const response = await axios.put(`${API_URL}/patients/${patientId}/medical-records/${recordId}`, data, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
  });
  return response.data;
}

export async function deleteMedicalRecord(patientId, recordId) {
  const response = await axios.delete(`${API_URL}/patients/${patientId}/medical-records/${recordId}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export default {
  getMedicalRecords,
  getMedicalRecordById,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
}; 