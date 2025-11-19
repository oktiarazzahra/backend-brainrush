// Script untuk membuat akun admin
// Jalankan: node createAdmin.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./src/models/User');

const createAdmin = async () => {
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in .env file');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const adminExists = await User.findOne({ email: 'admin@brainrush.com' });
    
    if (adminExists) {
      console.log('⚠️  Admin account already exists!');
      console.log('Email:', adminExists.email);
      console.log('Name:', adminExists.name);
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      name: 'Admin Brain Rush',
      email: 'admin@brainrush.com',
      password: 'admin123', // Ganti password ini!
      role: 'admin',
      isVerified: true,
      avatar: 'avatar-1'
    });

    console.log('✅ Admin account created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Password: admin123');
    console.log('👤 Role:', admin.role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  PENTING: Segera ganti password setelah login pertama!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
};

createAdmin();
