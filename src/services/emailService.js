const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // Hoặc service khác như 'outlook', 'yahoo'
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS // App password cho Gmail
    }
  });
};

const emailService = {
  async sendResetPasswordEmail(email, resetToken, userName) {
    try {
      const transporter = createTransporter();
      
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Reset Password - EduMap',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Reset Password</h2>
            <p>Xin chào ${userName},</p>
            <p>Bạn đã yêu cầu reset password cho tài khoản EduMap của mình.</p>
            <p>Nhấp vào link bên dưới để reset password:</p>
            <a href="${resetUrl}" 
               style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">
              Reset Password
            </a>
            <p>Link này sẽ hết hạn sau 15 phút.</p>
            <p>Nếu bạn không yêu cầu reset password, vui lòng bỏ qua email này.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              Email này được gửi tự động từ hệ thống EduMap. Vui lòng không trả lời email này.
            </p>
          </div>
        `
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Reset password email sent:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending reset password email:', error);
      throw new Error('Failed to send reset password email');
    }
  }
};

module.exports = emailService;
