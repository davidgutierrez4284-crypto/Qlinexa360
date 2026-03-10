import axios from 'axios';

const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  },
});

export const getDoctorFormTemplates = async () => {
  const { data } = await axios.get('/api/doctor-form-templates', getAuthHeaders());
  return data;
};

export const createDoctorFormTemplate = async (name, fields) => {
  const { data } = await axios.post(
    '/api/doctor-form-templates',
    { name, fields },
    getAuthHeaders()
  );
  return data;
};

export const updateDoctorFormTemplate = async (id, { name, fields }) => {
  const { data } = await axios.put(
    `/api/doctor-form-templates/${id}`,
    { name, fields },
    getAuthHeaders()
  );
  return data;
};

export const deleteDoctorFormTemplate = async (id) => {
  await axios.delete(`/api/doctor-form-templates/${id}`, getAuthHeaders());
};

export const saveDoctorFormData = async (medicalRecordId, templateId, patientId, data) => {
  const { data: result } = await axios.post(
    '/api/doctor-form-templates/data',
    { medicalRecordId, templateId, patientId, data },
    getAuthHeaders()
  );
  return result;
};

export const getDoctorFormDataForCharts = async (patientId, templateId) => {
  const { data } = await axios.get('/api/doctor-form-templates/data/charts', {
    ...getAuthHeaders(),
    params: { patientId, templateId },
  });
  return data;
};
