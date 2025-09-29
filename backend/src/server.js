import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './interfaces/authRoutes.js';
import problemRoutes from './interfaces/problemRoutes.js';
import submissionRoutes from './interfaces/submissionRoutes.js';
import adminRoutes from './interfaces/adminRoutes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/auth', authRoutes);
app.use('/problems', problemRoutes);
app.use('/submissions', submissionRoutes);
app.use('/admin', adminRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
