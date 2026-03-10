import axios from 'axios';

export const getDoctorProfile = async () => {
  try {
    const response = await axios.get('/api/doctors/profile', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener perfil del doctor:', error);
    throw error;
  }
};

export const getDoctorId = async () => {
  try {
    const profile = await getDoctorProfile();
    return profile.data?.id || null;
  } catch (error) {
    console.error('Error al obtener ID del doctor:', error);
    return null;
  }
};
