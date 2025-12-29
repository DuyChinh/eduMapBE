const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for 465, false for others
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS // App password cho Gmail
    }
  });
};

const emailService = {
  async sendResetPasswordEmail(email, otp, userName) {
    try {
      const transporter = createTransporter();
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'OTP Code for Password Reset - EduMap',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Reset Password</h2>
            <p>Hello ${userName},</p>
            <p>You have requested to reset your password for your EduMap account.</p>
            <p>Your OTP code is:</p>
            <div style="background-color: #f8f9fa; border: 2px solid #007bff; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 4px;">${otp}</span>
            </div>
            <p><strong>Important Notes:</strong></p>
            <ul style="color: #666;">
              <li>This OTP code will expire in 15 minutes</li>
              <li>Enter this code on the password reset page to continue</li>
              <li>Do not share this code with anyone</li>
            </ul>
            <p>If you did not request a password reset, please ignore this email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              This email was sent automatically from the EduMap system. Please do not reply to this email.
            </p>
          </div>
        `
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Reset password OTP email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending reset password email:', error);
      throw new Error('Failed to send reset password email');
    }
  }
};

module.exports = emailService;
