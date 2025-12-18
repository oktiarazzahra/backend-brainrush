#!/bin/bash

# Deploy Helper Script for Backend

echo "🚀 Backend Deploy Helper"
echo "========================"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "⚠️  Git belum diinisialisasi!"
    echo "Jalankan command ini:"
    echo ""
    echo "git init"
    echo "git add ."
    echo "git commit -m 'Initial commit - Backend Brainrush'"
    echo "git branch -M main"
    echo "git remote add origin https://github.com/YOUR_USERNAME/backend-brainrush.git"
    echo "git push -u origin main"
    echo ""
    exit 1
fi

echo "✅ Git sudah diinisialisasi"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  File .env tidak ditemukan!"
    echo "Buat file .env dengan isi dari .env.example"
    exit 1
fi

echo "✅ File .env ditemukan"
echo ""

# Check node_modules
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "✅ Dependencies OK"
echo ""

# Test local
echo "🧪 Testing backend locally..."
echo ""

# Kill existing process on port 5000
lsof -ti:5000 | xargs kill -9 2>/dev/null

# Start server in background
npm start &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test endpoint
echo "Testing /api/auth/test endpoint..."
RESPONSE=$(curl -s http://localhost:5000/api/auth/test)

if [ -z "$RESPONSE" ]; then
    echo "❌ Server tidak merespon!"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo "✅ Backend berjalan dengan baik!"
echo "Response: $RESPONSE"
echo ""

# Kill test server
kill $SERVER_PID 2>/dev/null

echo "📋 Deployment Checklist:"
echo ""
echo "1. ✅ Git initialized"
echo "2. ✅ .env exists"
echo "3. ✅ Dependencies installed"
echo "4. ✅ Backend tested locally"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Push ke GitHub:"
echo "   git add ."
echo "   git commit -m 'Ready for deployment'"
echo "   git push"
echo ""
echo "2. Deploy di Railway:"
echo "   - Buka https://railway.app"
echo "   - Login dengan GitHub"
echo "   - New Project → Deploy from GitHub"
echo "   - Pilih repository ini"
echo ""
echo "3. Setup Environment Variables di Railway:"
echo "   Copy dari file .env kamu"
echo ""
echo "4. Generate Domain di Railway"
echo ""
echo "✨ Selesai! Lihat QUICK_DEPLOY.md untuk panduan lengkap."
