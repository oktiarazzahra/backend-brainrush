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
  players: [{
    userId: mongoose.Schema.Types.ObjectId,
    playerName: String,
    avatar: String,
    score: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now }
  }],
  currentQuestion: {
    type: Number,
    default: 0
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
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('LiveGame', liveGameSchema);
