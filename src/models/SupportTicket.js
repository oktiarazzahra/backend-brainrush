const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Bisa null jika user belum login
  },
  category: {
    type: String,
    enum: ['bug', 'feature', 'ui', 'performance', 'security', 'other'],
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  userAgent: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index untuk pencarian
supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ email: 1 });
supportTicketSchema.index({ category: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
