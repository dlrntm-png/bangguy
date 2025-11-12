import express from 'express';

const router = express.Router();

// Health check 엔드포인트 (DB 연결 없이 즉시 응답)
// UptimeRobot이 슬립 모드를 방지하기 위해 사용
router.get('/', (req, res) => {
  // DB 연결 없이 즉시 응답
  res.status(200).json({ 
    ok: true, 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;

