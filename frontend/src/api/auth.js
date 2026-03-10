import axios from 'axios';

const API_URL = '/api/auth';

export const login = async (email, password, trustedDeviceToken) => {
  const body = { email, password };
  if (trustedDeviceToken) body.trustedDeviceToken = trustedDeviceToken;
  const response = await axios.post(`${API_URL}/login`, body);
  return response.data;
};

export const register = async (data) => {
  const response = await axios.post(`${API_URL}/register`, data);
  return response.data;
};

export const setupTwoFactor = async (tempToken) => {
  const response = await axios.post(`${API_URL}/2fa/setup`, {}, {
    headers: {
      Authorization: `Bearer ${tempToken}`,
    },
  });
  return response.data;
};

export const verifyTwoFactor = async (tempToken, code, rememberDevice = false) => {
  const response = await axios.post(`${API_URL}/2fa/verify`, { token: code, rememberDevice }, {
    headers: {
      Authorization: `Bearer ${tempToken}`,
    },
  });
  return response.data;
};

export const sendTwoFactorRecoveryEmail = async (tempToken) => {
  const response = await axios.post(`${API_URL}/2fa/recovery-email`, {}, {
    headers: {
      Authorization: `Bearer ${tempToken}`,
    },
  });
  return response.data;
};

export const verifyTwoFactorRecovery = async (tempToken, code) => {
  const response = await axios.post(`${API_URL}/2fa/recovery-verify`, { code }, {
    headers: {
      Authorization: `Bearer ${tempToken}`,
    },
  });
  return response.data;
};