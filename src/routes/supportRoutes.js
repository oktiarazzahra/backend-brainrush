const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  createTicket,
  getAllTickets,
  getTicketById,
  updateTicket,
  getMyTickets,
  replyTicket
} = require('../controllers/supportController');

// @route   POST /api/support/tickets
// @desc    Create new support ticket
// @access  Public (bisa tanpa login)
router.post('/tickets', createTicket);

// @route   GET /api/support/my-tickets
// @desc    Get current user's tickets
// @access  Private
router.get('/my-tickets', protect, getMyTickets);

// @route   GET /api/support/tickets
// @desc    Get all tickets (Admin only)
// @access  Private/Admin
router.get('/tickets', protect, getAllTickets);

// @route   GET /api/support/tickets/:id
// @desc    Get ticket by ID
// @access  Private
router.get('/tickets/:id', protect, getTicketById);

// @route   PUT /api/support/tickets/:id
// @desc    Update ticket (Admin only)
// @access  Private/Admin
router.put('/tickets/:id', protect, updateTicket);

// @route   POST /api/support/tickets/:id/reply
// @desc    Reply to ticket via Nodemailer (Admin only)
// @access  Private/Admin
router.post('/tickets/:id/reply', protect, replyTicket);

module.exports = router;
