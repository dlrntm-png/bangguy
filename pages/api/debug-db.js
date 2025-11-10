import { Pool } from 'pg';

export default async function handler(req, res) {
  const response = {
    ok: false,
    message: '',
    details: null
  };

  try {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      response.message = 'POSTGRES_URL 환경 변수가 설정되지 않았습니다.';
      return res.status(500).json(response);
    }

    const pool = new Pool({
      connectionString,
      ssl: (process.env.POSTGRES_SSL || 'require').toLowerCase() === 'disable'
        ? false
        : { rejectUnauthorized: false }
    });

    const start = Date.now();
    const { rows } = await pool.query('SELECT NOW() AS server_time');
    const duration = Date.now() - start;

    await pool.end();

    response.ok = true;
    response.message = 'Connection successful';
    response.details = {
      serverTime: rows[0]?.server_time,
      durationMs: duration
    };
    return res.status(200).json(response);
  } catch (error) {
    response.message = error.message;
    response.details = {
      stack: error.stack
    };
    return res.status(500).json(response);
  }
}

