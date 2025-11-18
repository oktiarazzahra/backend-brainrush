const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const quizRoutes = require('./routes/quizRoutes');
const learningRoutes = require('./routes/learningRoutes');
const gameRoutes = require('./routes/gameRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' })); // Increase limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files (uploads folder) untuk cover images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/game', gameRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'BrainRush API is running!' });
});

module.exports = app;
