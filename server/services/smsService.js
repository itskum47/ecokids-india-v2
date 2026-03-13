const axios = require('axios');

const FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2';

const sendSms = async ({ phone, message, otp }) => {
  try {
    if (!phone || (!message && !otp)) return { success: false, skipped: true };
    if (!/^\d{10}$/.test(String(phone))) return { success: false, skipped: true };

    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey || apiKey === 'your_key_here') {
      return { success: false, skipped: true };
    }

    const isOtpFlow = Boolean(otp);

    const payload = isOtpFlow
      ? {
          route: 'otp',
          variables_values: String(otp),
          numbers: String(phone),
        }
      : {
          route: 'q',
          message,
          language: 'english',
          flash: 0,
          numbers: String(phone),
        };

    await axios.post(FAST2SMS_URL, payload, {
      headers: {
        authorization: process.env.FAST2SMS_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 8000,
    });

    return { success: true };
  } catch (error) {
    console.error('[SMS] send failure:', error?.response?.data || error.message);
    return { success: false };
  }
};

module.exports = { sendSms };
