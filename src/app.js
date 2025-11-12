const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const quizRoutes = require('./routes/quizRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploads folder) untuk cover images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'BrainRush API is running!' });
});

module.exports = app;
