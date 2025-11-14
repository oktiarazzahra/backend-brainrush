const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'Umum',
    },
    questions: [
      {
        question: {
          type: String,
          required: true,
        },
        questionType: {
          type: String,
          enum: [
            'Pilihan Ganda',
            'Benar Salah',
            'Isian',
            'multiple-choice',
            'multiple-answer',
            'true-false',
            'short-answer',
          ],
          default: 'Pilihan Ganda',
        },
        options: {
          type: [String],
          default: [],
        },
        correctAnswer: {
          type: mongoose.Schema.Types.Mixed,
        },
        acceptedAnswers: {
          type: [String],
          default: [],
        },
        timeLimit: {
          type: Number,
          default: 30,
        },
        // ← NEW: Image fields (Base64)
        imageData: {
          type: String,
          default: null,
        },
        imageName: {
          type: String,
          default: null,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDraft: {
      type: Boolean,
      default: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    totalPlays: {
      type: Number,
      default: 0,
    },
    hasHistory: {
      type: Boolean,
      default: false,
    },
    coverImage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Quiz', quizSchema);