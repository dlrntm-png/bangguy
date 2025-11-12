import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM에서 __dirname 사용
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 라우트 임포트
import attendRoutes from './routes/attend.js';
import adminRoutes from './routes/admin.js';
import consentRoutes from './routes/consent.js';
import ipStatusRoute from './routes/ip-status.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy 설정 (Railway, Vercel 등 프록시 환경)
app.set('trust proxy', true);

// CORS 설정
app.use(cors({
  origin: true,
  credentials: true
}));

// JSON 파싱
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 서빙 (public 폴더)
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// 스토리지 파일 서빙 (storage 폴더 - 업로드된 이미지)
const storagePath = path.join(__dirname, '..', 'storage');
app.use('/storage', express.static(storagePath));

// favicon.ico 요청 조용히 처리 (404 에러 방지)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content
});

// API 라우트
app.use('/api/ip-status', ipStatusRoute);
app.use('/api/attend', attendRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/consent', consentRoutes);

// 루트 경로는 index.html로 리다이렉트
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// 관리자 페이지
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(publicPath, 'admin.html'));
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Not Found' });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ ok: false, message: 'Internal Server Error', error: err.message });
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Static files: ${publicPath}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
}).on('error', (err) => {
  console.error('❌ Server failed to start:', err);
  process.exit(1);
});

