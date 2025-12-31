const nodemailer = require('nodemailer');
require('dotenv').config();

const translations = {
  vi: {
    subjectSuccess: '[EduMap] Xác nhận đăng ký thành công',
    header: 'Cảm ơn bạn đã đăng ký VIP! 🌟',
    subheader: 'Chào mừng bạn đến với trải nghiệm cao cấp của EduMap',
    greeting: 'Xin chào',
    body: 'Chúng tôi rất vui mừng thông báo tài khoản của bạn đã được nâng cấp thành công. Dưới đây là thông tin chi tiết:',
    planLabel: 'Gói cước:',
    priceLabel: 'Giá cước:',
    expiryLabel: 'Hết hạn vào:',
    benefitsLabel: 'Bạn giờ đây có thể tận hưởng các quyền lợi đặc biệt:',
    button: 'Trải nghiệm ngay',
    footerHelp: 'Nếu bạn có bất kỳ câu hỏi nào, vui lòng trả lời email này.',
    perMonth: '/tháng',
    proPlan: 'Gói Pro',
    plusPlan: 'Gói Plus',
    benefitAI15: '15 lượt Chat AI miễn phí mỗi ngày',
    benefitAI10: '10 lượt Chat AI miễn phí mỗi ngày',
    benefitPriority: 'Ưu tiên phản hồi cao nhất (Priority Support)',
    benefitStandard: 'Hỗ trợ ưu tiên tiêu chuẩn',
    benefitLibrary: 'Truy cập thư viện cộng đồng không giới hạn',
    benefitLibraryStd: 'Truy cập thư viện cộng đồng',
    benefitFeatures: 'Nhận các tính năng mới sớm nhất'
  },
  en: {
    subjectSuccess: '[EduMap] Subscription Confirmation',
    header: 'Thank you for subscribing to VIP! 🌟',
    subheader: 'Welcome to the premium experience of EduMap',
    greeting: 'Hello',
    body: 'We are excited to inform you that your account has been successfully upgraded. Here are the details:',
    planLabel: 'Plan:',
    priceLabel: 'Price:',
    expiryLabel: 'Expires on:',
    benefitsLabel: 'You can now enjoy these special benefits:',
    button: 'Experience Now',
    footerHelp: 'If you have any questions, please reply to this email.',
    perMonth: '/month',
    proPlan: 'Pro Plan',
    plusPlan: 'Plus Plan',
    benefitAI15: '15 Free AI Chat turns per day',
    benefitAI10: '10 Free AI Chat turns per day',
    benefitPriority: 'High Priority Support',
    benefitStandard: 'Standard Priority Support',
    benefitLibrary: 'Unlimited Community Library Access',
    benefitLibraryStd: 'Access to Community Library',
    benefitFeatures: 'Early Access to New Features'
  },
  jp: {
    subjectSuccess: '[EduMap] VIP登録確認',
    header: 'VIP登録ありがとうございます！ 🌟',
    subheader: 'EduMapのプレミアム体験へようこそ',
    greeting: 'こんにちは',
    body: 'アカウントのアップグレードが完了しました。詳細は以下の通りです：',
    planLabel: 'プラン:',
    priceLabel: '価格:',
    expiryLabel: '有効期限:',
    benefitsLabel: '以下の特典をお楽しみいただけます:',
    button: '今すぐ体験',
    footerHelp: 'ご質問がございましたら、このメールにご返信ください。',
    perMonth: '/月',
    proPlan: 'Proプラン',
    plusPlan: 'Plusプラン',
    benefitAI15: '毎日15回のAIチャット',
    benefitAI10: '毎日10回のAIチャット',
    benefitPriority: '最優先サポート (Priority Support)',
    benefitStandard: '標準優先サポート',
    benefitLibrary: 'コミュニティライブラリへの無制限アクセス',
    benefitLibraryStd: 'コミュニティライブラリへのアクセス',
    benefitFeatures: '新機能への早期アクセス'
  }
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendSubscriptionSuccessEmail = async (toEmail, userName, planName, expiryDate, language = 'vi') => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('Email credentials not found. Skipping email send.');
      return;
    }

    const t = translations[language] || translations['vi']; // Fallback to 'vi'
    const locale = language === 'vi' ? 'vi-VN' : (language === 'jp' ? 'ja-JP' : 'en-US');

    const formattedDate = new Date(expiryDate).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const planDisplay = planName === 'pro' ? t.proPlan : t.plusPlan;
    const priceDisplay = planName === 'pro' ? '20.000 VNĐ' : '10.000 VNĐ'; // Keeping currency VND for now as payments are likely VND

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f6f9; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
                .header { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 30px; text-align: center; color: white; }
                .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
                .content { padding: 40px 30px; }
                .features-box { background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #6366f1; }
                .features-list { margin: 0; padding: 0; color: #4b5563; list-style-type: none; }
                .features-list li { margin-bottom: 8px; display: flex; align-items: center; }
                .footer { background-color: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
                .button { display: inline-block; padding: 12px 24px; background-color: #6366f1; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 20px; }
                .info-table { width: 100%; border-collapse: collapse; }
                .info-table td { padding: 10px 0; border-bottom: 1px solid #eee; }
                .info-table tr:last-child td { border-bottom: none; }
                .label { font-weight: 600; color: #64748b; width: 40%; }
                .value { font-weight: 700; color: #333; text-align: right; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${t.header}</h1>
                    <p>${t.subheader}</p>
                </div>
                <div class="content">
                    <p>${t.greeting} <strong>${userName}</strong>,</p>
                    <p>${t.body}</p>
                    
                    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <table class="info-table">
                            <tr>
                                <td class="label">${t.planLabel}</td>
                                <td class="value">${planDisplay}</td>
                            </tr>
                            <tr>
                                <td class="label">${t.priceLabel}</td>
                                <td class="value">${priceDisplay}${t.perMonth}</td>
                            </tr>
                            <tr>
                                <td class="label">${t.expiryLabel}</td>
                                <td class="value">${formattedDate}</td>
                            </tr>
                        </table>
                    </div>

                    <p>${t.benefitsLabel}</p>
                    <div class="features-box">
                        <ul class="features-list">
                            ${planName === 'pro'
        ? `
                                <li>✨ &nbsp; <strong>${t.benefitAI15}</strong></li>
                                <li>✨ &nbsp; ${t.benefitPriority}</li>
                                <li>✨ &nbsp; ${t.benefitLibrary}</li>
                                <li>✨ &nbsp; ${t.benefitFeatures}</li>
                                `
        : `
                                <li>⚡ &nbsp; <strong>${t.benefitAI10}</strong></li>
                                <li>⚡ &nbsp; ${t.benefitLibraryStd}</li>
                                <li>⚡ &nbsp; ${t.benefitStandard}</li>
                                `
      }
                        </ul>
                    </div>
                    <div style="text-align: center;">
                        <a href="http://localhost:5173/chat" class="button">${t.button}</a>
                    </div>
                </div>
                <div class="footer">
                    <p>${t.footerHelp}</p>
                    <p>&copy; ${new Date().getFullYear()} EduMap. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;

    const mailOptions = {
      from: `"EduMap Support" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `${t.subjectSuccess} ${planDisplay}`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${toEmail} (${language})`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

module.exports = {
  sendSubscriptionSuccessEmail
};
