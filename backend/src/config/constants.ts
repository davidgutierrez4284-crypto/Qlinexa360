export const AUTH = {
  JWT_EXPIRES_IN: '24h',
  PASSWORD_SALT_ROUNDS: 10
};

export const FILE = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf']
};

export const SUBSCRIPTION = {
  PLANS: {
    BASIC: 'basic',
    PREMIUM: 'premium',
    ENTERPRISE: 'enterprise'
  },
  TRIAL_PERIOD_DAYS: 14
};

export const ROLES = {
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
  PATIENT: 'PATIENT'
};

export const CONSENT_TYPES = {
  PRIVACY_POLICY: 'privacy_policy',
  TERMS_OF_SERVICE: 'terms_of_service',
  MEDICAL_CONSENT: 'medical_consent'
};

export const PAYMENT = {
  CURRENCY: 'MXN',
  PAYMENT_METHODS: {
    PAYPAL: 'paypal',
    CREDIT_CARD: 'credit_card'
  }
};

export const NOTIFICATION = {
  TYPES: {
    EMAIL: 'email',
    WHATSAPP: 'whatsapp',
    SMS: 'sms'
  },
  CHANNELS: {
    APPOINTMENT_REMINDER: 'appointment_reminder',
    PRESCRIPTION_READY: 'prescription_ready',
    PAYMENT_CONFIRMATION: 'payment_confirmation'
  }
}; 