const nodemailer = require('nodemailer');

// Create SMTP transporter
// Supports Gmail, Outlook, or custom SMTP server
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports (587 uses STARTTLS)
  auth: {
    user: process.env.SMTP_USER, // Email address (e.g., youremail@gmail.com)
    pass: process.env.SMTP_PASS  // App password (NOT your regular Gmail password)
  },
  tls: {
    rejectUnauthorized: false // Accept self-signed certificates
  }
});

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP connection error:', error.message);
    console.error('⚠️  Make sure SMTP credentials are configured correctly in .env file');
  } else {
    console.log('✅ SMTP Server ready to send emails');
    console.log(`📧 Using: ${process.env.SMTP_USER || 'No email configured'}`);
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
    console.log('✅ Email sent successfully!');
    console.log(`📧 To: ${to}`);
    console.log(`📬 Subject: ${subject}`);
    console.log(`🆔 Message ID: ${info.messageId}`);
    
    // Only show preview URL if using Ethereal (test account)
    if (process.env.SMTP_HOST && process.env.SMTP_HOST.includes('ethereal')) {
      console.log('🔗 Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    console.error('❌ Email send error:', error.message);
    console.error('⚠️  Check your SMTP credentials and internet connection');
    throw error;
  }
};

module.exports = { sendMail };
