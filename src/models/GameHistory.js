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
      question: String,  // Question text
      userAnswer: mongoose.Schema.Types.Mixed,  // Can be string or array
      correctAnswer: mongoose.Schema.Types.Mixed,  // Can be string, array, or boolean
      isCorrect: Boolean,
      timeSpent: Number
    }]
  }],
  totalPlayers: Number,
  startedAt: Date,
  endedAt: Date,
  pinDurationHours: {
    type: Number,
    default: null // Duration of PIN in hours
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('GameHistory', gameHistorySchema);
