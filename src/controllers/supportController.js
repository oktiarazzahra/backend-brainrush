const SupportTicket = require('../models/SupportTicket');
const { sendMail } = require('../utils/mailer');

// @desc    Create new support ticket
// @route   POST /api/support/tickets
// @access  Public
exports.createTicket = async (req, res) => {
  try {
    console.log('📝 Creating new support ticket...');
    const { category, subject, description, email, userAgent } = req.body;
    console.log('📧 From:', email, '| Subject:', subject);

    // Validasi input
    if (!category || !subject || !description || !email) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Mohon lengkapi semua field yang diperlukan'
      });
    }

    // Validasi email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid'
      });
    }

    // Buat ticket baru
    const ticket = await SupportTicket.create({
      userId: req.user ? req.user._id : null, // Jika user login, simpan userId
      category,
      subject,
      description,
      email,
      userAgent: userAgent || req.headers['user-agent'] || ''
    });

    // Kirim email notifikasi ke admin (opsional)
    try {
      const categoryNames = {
        bug: 'Bug/Error',
        feature: 'Permintaan Fitur',
        ui: 'Masalah UI/UX',
        performance: 'Performa',
        security: 'Keamanan',
        other: 'Lainnya'
      };

      await sendMail({
        to: 'support@brainrush.com',
        subject: `[NEW TICKET #${ticket._id}] ${categoryNames[category]}: ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Laporan Baru dari Brain Rush</h2>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <p><strong>Ticket ID:</strong> ${ticket._id}</p>
              <p><strong>Kategori:</strong> ${categoryNames[category]}</p>
              <p><strong>Judul:</strong> ${subject}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Tanggal:</strong> ${new Date(ticket.createdAt).toLocaleString('id-ID')}</p>
            </div>
            <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
              <h3>Deskripsi:</h3>
              <p style="white-space: pre-wrap;">${description}</p>
            </div>
            <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">
              User Agent: ${ticket.userAgent}
            </p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // Tidak perlu throw error, ticket tetap tersimpan
    }

    // Kirim email konfirmasi ke user
    try {
      await sendMail({
        to: email,
        subject: `Laporan Anda telah diterima - Ticket #${ticket._id}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Terima kasih atas laporan Anda!</h2>
            <p>Halo,</p>
            <p>Laporan Anda telah kami terima dan sedang ditinjau oleh tim Brain Rush.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <p><strong>Ticket ID:</strong> ${ticket._id}</p>
              <p><strong>Judul:</strong> ${subject}</p>
              <p><strong>Status:</strong> Open</p>
            </div>
            <p>Tim kami akan segera menghubungi Anda melalui email ini jika diperlukan informasi tambahan.</p>
            <p style="color: #6b7280; margin-top: 30px;">
              Salam,<br>
              <strong>Tim Brain Rush</strong>
            </p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Laporan berhasil dikirim. Terima kasih!',
      data: {
        ticketId: ticket._id,
        category: ticket.category,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt
      }
    });
    
    console.log('✅ Ticket created successfully:', ticket._id);

  } catch (error) {
    console.error('❌ Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengirim laporan'
    });
  }
};

// @desc    Get all tickets (Admin only)
// @route   GET /api/support/tickets
// @access  Private/Admin
exports.getAllTickets = async (req, res) => {
  try {
    console.log('🔍 Admin fetching all tickets...');
    console.log('👤 Requested by:', req.user?.email);
    
    const { status, category, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const tickets = await SupportTicket.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await SupportTicket.countDocuments(filter);

    console.log(`✅ Found ${tickets.length} tickets (Total: ${count})`);

    res.json({
      success: true,
      data: {
        tickets,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count
      }
    });

  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data ticket'
    });
  }
};

// @desc    Get ticket by ID
// @route   GET /api/support/tickets/:id
// @access  Private
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('userId', 'name email avatar');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: ticket
    });

  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data ticket'
    });
  }
};

// @desc    Update ticket status (Admin only)
// @route   PUT /api/support/tickets/:id
// @access  Private/Admin
exports.updateTicket = async (req, res) => {
  try {
    const { status, priority, adminNotes } = req.body;

    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket tidak ditemukan'
      });
    }

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (adminNotes) ticket.adminNotes = adminNotes;

    if (status === 'resolved' || status === 'closed') {
      ticket.resolvedAt = Date.now();
    }

    await ticket.save();

    res.json({
      success: true,
      message: 'Ticket berhasil diupdate',
      data: ticket
    });

  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat update ticket'
    });
  }
};

// @desc    Get my tickets
// @route   GET /api/support/my-tickets
// @access  Private
exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({
      $or: [
        { userId: req.user._id },
        { email: req.user.email }
      ]
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: tickets
    });

  } catch (error) {
    console.error('Get my tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat mengambil data ticket'
    });
  }
};

// @desc    Reply to ticket via Nodemailer (Admin only)
// @route   POST /api/support/tickets/:id/reply
// @access  Private/Admin
exports.replyTicket = async (req, res) => {
  try {
    console.log('📧 Admin replying to ticket:', req.params.id);
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject dan message tidak boleh kosong'
      });
    }

    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket tidak ditemukan'
      });
    }

    // Kirim email balasan via Nodemailer
    try {
      await sendMail({
        to: ticket.email,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎓 Brain Rush</h1>
              <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Quiz Game Platform</p>
            </div>
            
            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
              <h2 style="color: #1f2937; margin-top: 0;">Balasan untuk Ticket #${ticket._id.toString().slice(-6)}</h2>
              
              <div style="background: #f9fafb; padding: 15px; border-left: 4px solid #6366f1; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #6b7280; font-size: 13px; font-weight: 600;">TICKET ORIGINAL:</p>
                <p style="margin: 5px 0 0 0; color: #1f2937; font-weight: 600;">${ticket.subject}</p>
              </div>
              
              <div style="margin: 25px 0;">
                <p style="color: #6b7280; font-size: 13px; font-weight: 600; margin-bottom: 10px;">BALASAN DARI ADMIN:</p>
                <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; white-space: pre-wrap; line-height: 1.6;">
                  ${message}
                </div>
              </div>
              
              <div style="background: #eff6ff; border: 1px solid #dbeafe; padding: 15px; border-radius: 8px; margin-top: 25px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px;">
                  💡 <strong>Perlu bantuan lebih lanjut?</strong><br>
                  Balas email ini atau buat laporan baru di aplikasi Brain Rush.
                </p>
              </div>
            </div>
            
            <div style="background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="color: #6b7280; font-size: 13px; margin: 0;">
                Email ini dikirim otomatis dari <strong>Brain Rush Support Team</strong><br>
                © ${new Date().getFullYear()} Brain Rush. All rights reserved.
              </p>
            </div>
          </div>
        `
      });

      console.log('✅ Reply email sent successfully to:', ticket.email);

      // Update ticket status jika diperlukan
      if (ticket.status === 'open') {
        ticket.status = 'in-progress';
        await ticket.save();
      }

      res.json({
        success: true,
        message: 'Balasan berhasil dikirim via email'
      });

    } catch (emailError) {
      console.error('❌ Error sending reply email:', emailError);
      throw new Error('Gagal mengirim email: ' + emailError.message);
    }

  } catch (error) {
    console.error('Reply ticket error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat mengirim balasan'
    });
  }
};
