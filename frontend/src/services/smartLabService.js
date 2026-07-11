import axios from 'axios';
import { getApiUrl, getApiHeaders } from '../utils/api';

const API_BASE = '/api/smart-lab';

function headers(extra = {}) {
  return { ...getApiHeaders(), ...extra };
}

export async function getSmartLabStatus() {
  const { data } = await axios.get(getApiUrl(API_BASE + '/status'), { headers: headers() });
  return data;
}

export async function uploadLabReport(patientId, file, onUploadProgress) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await axios.post(
    getApiUrl(API_BASE + '/patients/' + patientId + '/reports/upload'),
    form,
    {
      headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }
  );
  return data;
}

export async function listPatientReports(patientId) {
  const { data } = await axios.get(getApiUrl(API_BASE + '/patients/' + patientId + '/reports'), { headers: headers() });
  return data;
}

export async function getLabReport(reportId) {
  const { data } = await axios.get(getApiUrl(API_BASE + '/reports/' + reportId), { headers: headers() });
  return data;
}

export async function processLabReport(reportId) {
  const { data } = await axios.post(getApiUrl(API_BASE + '/reports/' + reportId + '/process'), {}, { headers: headers() });
  return data;
}

export async function patchLabReportResults(reportId, results) {
  const { data } = await axios.patch(
    getApiUrl(API_BASE + '/reports/' + reportId + '/results'),
    { results },
    { headers: headers({ 'Content-Type': 'application/json' }) }
  );
  return data;
}

export async function confirmLabReport(reportId, results) {
  const body = results && results.length ? { results } : {};
  const { data } = await axios.post(
    getApiUrl(API_BASE + '/reports/' + reportId + '/confirm'),
    body,
    { headers: headers({ 'Content-Type': 'application/json' }) }
  );
  return data;
}

export async function rejectLabReport(reportId, reason) {
  const { data } = await axios.post(
    getApiUrl(API_BASE + '/reports/' + reportId + '/reject'),
    { reason },
    { headers: headers({ 'Content-Type': 'application/json' }) }
  );
  return data;
}


export async function deleteLabReport(reportId) {
  const { data } = await axios.delete(getApiUrl(API_BASE + '/reports/' + reportId), { headers: headers() });
  return data;
}

export async function downloadLabReportPdf(reportId) {
  const { data } = await axios.get(getApiUrl(API_BASE + '/reports/' + reportId + '/download'), { headers: headers() });
  return data;
}

export async function getPatientLabDashboard(patientId) {
  const { data } = await axios.get(getApiUrl(API_BASE + '/patients/' + patientId + '/dashboard'), { headers: headers() });
  return data;
}

export async function getPatientLabAlerts(patientId) {
  const { data } = await axios.get(getApiUrl(API_BASE + '/patients/' + patientId + '/alerts'), { headers: headers() });
  return data;
}

export async function dismissLabAlert(alertId) {
  const { data } = await axios.post(getApiUrl(API_BASE + '/alerts/' + alertId + '/dismiss'), {}, { headers: headers() });
  return data;
}

export async function comparePatientAnalyte(patientId, analyteCatalogId, limit) {
  const params = { analyteCatalogId };
  if (limit) params.limit = limit;
  const { data } = await axios.get(getApiUrl(API_BASE + '/patients/' + patientId + '/compare'), {
    headers: headers(),
    params,
  });
  return data;
}

export async function compareLabReports(reportIds) {
  const ids = Array.isArray(reportIds) ? reportIds : [reportIds];
  const { data } = await axios.get(getApiUrl(API_BASE + '/reports/compare'), {
    headers: headers(),
    params: { reportIds: ids.join(',') },
  });
  return data;
}

export async function listAnalyteCatalog(params = {}) {
  const { data } = await axios.get(getApiUrl(API_BASE + '/catalog'), { headers: headers(), params });
  return data;
}

export async function listAdminAnalyteCatalog(params = {}) {
  const { data } = await axios.get(getApiUrl(API_BASE + '/admin/catalog'), { headers: headers(), params });
  return data;
}

export async function createAdminAnalyteCatalog(payload) {
  const { data } = await axios.post(
    getApiUrl(API_BASE + '/admin/catalog'),
    payload,
    { headers: headers({ 'Content-Type': 'application/json' }) }
  );
  return data;
}

export async function updateAdminAnalyteCatalog(id, payload) {
  const { data } = await axios.patch(
    getApiUrl(API_BASE + '/admin/catalog/' + id),
    payload,
    { headers: headers({ 'Content-Type': 'application/json' }) }
  );
  return data;
}

export default {
  getSmartLabStatus,
  uploadLabReport,
  listPatientReports,
  getLabReport,
  processLabReport,
  patchLabReportResults,
  confirmLabReport,
  rejectLabReport,
  deleteLabReport,
  downloadLabReportPdf,
  getPatientLabDashboard,
  getPatientLabAlerts,
  dismissLabAlert,
  comparePatientAnalyte,
  compareLabReports,
  listAnalyteCatalog,
  listAdminAnalyteCatalog,
  createAdminAnalyteCatalog,
  updateAdminAnalyteCatalog,
};
