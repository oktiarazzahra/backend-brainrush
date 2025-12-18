const mongoose = require('mongoose');
const generatePIN = require('../utils/generatePIN');

const liveGameSchema = new mongoose.Schema({
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  PIN: {
    type: String,
    default: generatePIN,
    unique: true
  },
  pinExpiresAt: {
    type: Date,
    default: null
  },
  players: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false  // Optional for guest players
    },
    playerName: String,
    avatar: {
      type: mongoose.Schema.Types.Mixed,
      default: '👤'
    },
    isGuest: {
      type: Boolean,
      default: false
    },
    score: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
    answers: [{
      questionId: mongoose.Schema.Types.ObjectId,
      answer: mongoose.Schema.Types.Mixed,
      isCorrect: Boolean,
      answeredAt: { type: Date, default: Date.now },
      timeSpent: { type: Number, default: null },
      autoSaved: { type: Boolean, default: false }
    }]
  }],
  currentQuestion: {
    type: Number,
    default: 0
  },
  questionStartedAt: {
    type: Date,
    default: null
  },
  gameStatus: {
    type: String,
    enum: ['waiting', 'running', 'ended'],
    default: 'waiting'
  },
  maxPlayers: {
    type: Number,
    default: 50
  },
  startedAt: Date,
  endedAt: Date,
  results: [{
    userId: mongoose.Schema.Types.ObjectId,
    playerName: String,
    finalScore: Number,
    rank: Number
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // TTL: Auto-delete after 24 hours (in seconds)
  }
}, { timestamps: true });

module.exports = mongoose.model('LiveGame', liveGameSchema);
