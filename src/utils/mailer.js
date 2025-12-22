const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Kirim email menggunakan Resend
 * @param {Object} options
 * @param {string} options.to - Email penerima
 * @param {string} options.subject - Subjek email
 * @param {string} options.html - Konten HTML
 */
const sendMail = async ({ to, subject, html }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: `${process.env.FROM_NAME || 'Brain Rush'} <${process.env.FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    if (error) throw error;
    console.log('✅ Email sent:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Email send error:', error.message);
    console.error('⚠️  Pastikan API Key dan email pengirim sudah benar & terverifikasi di Resend');
    throw error;
  }
};

module.exports = { sendMail };
