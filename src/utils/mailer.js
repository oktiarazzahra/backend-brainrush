const nodemailer = require('nodemailer');

// Create Ethereal SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports (587 uses STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Nodemailer connection error:', error.message);
  } else {
    console.log('✅ Nodemailer ready to send emails');
  }
});

/**
 * Send email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 */
const sendMail = async ({ to, subject, text, html }) => {
  try {
    const mailOptions = {
      from: `${process.env.FROM_NAME || 'Brain Rush'} <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email sent:', info.messageId);
    console.log('🔗 Preview URL:', nodemailer.getTestMessageUrl(info));
    return info;
  } catch (error) {
    console.error('❌ Email send error:', error.message);
    throw error;
  }
};

module.exports = { sendMail };
