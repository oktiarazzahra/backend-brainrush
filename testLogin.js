// Test login admin
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./src/models/User');

const testLogin = async () => {
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find admin user
    const admin = await User.findOne({ email: 'admin@brainrush.com' }).select('+password');
    
    if (!admin) {
      console.log('❌ Admin account not found!');
      console.log('Run: node createAdmin.js to create admin account');
      process.exit(1);
    }

    console.log('✅ Admin account found!');
    console.log('Email:', admin.email);
    console.log('Name:', admin.name);
    console.log('Role:', admin.role);
    console.log('Is Verified:', admin.isVerified);
    console.log('Password Hash:', admin.password.substring(0, 20) + '...');

    // Test password
    const testPassword = 'admin123';
    const isMatch = await bcrypt.compare(testPassword, admin.password);
    
    console.log('\n🔑 Password Test:');
    console.log('Testing password: admin123');
    console.log('Result:', isMatch ? '✅ MATCH' : '❌ NOT MATCH');

    if (!isMatch) {
      console.log('\n⚠️  Password tidak cocok!');
      console.log('Possible issues:');
      console.log('1. Admin account dibuat dengan password berbeda');
      console.log('2. Password tidak ter-hash dengan benar');
      console.log('\nSolusi: Hapus admin dan buat ulang dengan: node createAdmin.js');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

testLogin();
