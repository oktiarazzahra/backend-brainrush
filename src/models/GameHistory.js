const mongoose = require('mongoose');

const gameHistorySchema = new mongoose.Schema({
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  PIN: {
    type: String,
    unique: true
  },
  playerResults: [{
    userId: mongoose.Schema.Types.ObjectId,
    playerName: String,
    avatar: String,
    score: Number,
    totalPoints: Number,
    rank: Number,
    answers: [{
      questionId: mongoose.Schema.Types.ObjectId,
      userAnswer: String,
      isCorrect: Boolean,
      timeSpent: Number
    }]
  }],
  totalPlayers: Number,
  startedAt: Date,
  endedAt: Date,
  completedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('GameHistory', gameHistorySchema);
