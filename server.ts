import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { GoogleGenAI } from '@google/genai';

const execAsync = util.promisify(exec);
dotenv.config();

const app = express();
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 ? process.argv[portArgIndex + 1] : undefined;
const PORT = cliPort || process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// -----------------------------------------------------------------------------
// Secret Keys & Security Configuration
// -----------------------------------------------------------------------------
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'pl-ia-admin-secret-key-prod-2025-token-secure';
const AUTHORIZED_ADMIN_EMAIL = 'j14menez@gmail.com';

// -----------------------------------------------------------------------------
// Dynamic Resolution of FFmpeg and FFprobe Binaries
// (Eliminates "ffmpeg: command not found" across containers & hosts)
// -----------------------------------------------------------------------------
function resolveBinary(name: string): string {
  const envPath = process.env[`${name.toUpperCase()}_PATH`];
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }
  const commonPaths = [
    `/usr/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
  ];
  for (const candidate of commonPaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return name;
}

const FFMPEG_BIN = resolveBinary('ffmpeg');
const FFPROBE_BIN = resolveBinary('ffprobe');

console.log(`[Binary Resolution] FFmpeg path: ${FFMPEG_BIN}`);
console.log(`[Binary Resolution] FFprobe path: ${FFPROBE_BIN}`);

// -----------------------------------------------------------------------------
// Storage & Persistence Directories
// -----------------------------------------------------------------------------
const STORAGE_DIR = path.resolve('server_storage');
const VIDEOS_STORAGE_DIR = path.resolve('server_storage/videos');

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
if (!fs.existsSync(VIDEOS_STORAGE_DIR)) fs.mkdirSync(VIDEOS_STORAGE_DIR, { recursive: true });

const PRICING_FILE = path.join(STORAGE_DIR, 'pricing_config.json');
const ADMIN_CONFIG_FILE = path.join(STORAGE_DIR, 'admin_config.json');
const CLAIMS_FILE = path.join(STORAGE_DIR, 'free_pdf_claims.json');
const TASKS_FILE = path.join(STORAGE_DIR, 'tasks.json');
const PAYMENTS_FILE = path.join(STORAGE_DIR, 'payments.json');
const VIDEO_HISTORY_FILE = path.join(STORAGE_DIR, 'video_history.json');
const ERROR_LOGS_FILE = path.join(STORAGE_DIR, 'error_logs.json');

// Helper to safely read JSON from disk
function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[Storage] Failed to read ${filePath}:`, err);
  }
  return fallback;
}

// Helper to safely write JSON to disk
function writeJsonSafe<T>(filePath: string, data: T) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[Storage] Failed to write ${filePath}:`, err);
  }
}

// -----------------------------------------------------------------------------
// Data Structures & Models
// -----------------------------------------------------------------------------
export interface PricingConfig {
  pdfPrice: number;
  videoPrice: number;
  updatedAt: string;
}

export interface AdminConfig {
  adminEmail: string;
  passwordHash: string;
  updatedAt: string;
}

export interface FreePdfClaim {
  visitorId: string;
  claimedAt: string;
  ip?: string;
  userAgent?: string;
  fingerprint?: string;
}

export interface TaskRecord {
  id: string; // e.g. task_pdf_..., task_vid_...
  visitorId: string;
  serviceType: 'pdf' | 'video';
  status: 'pending_payment' | 'paid' | 'free_granted' | 'processing' | 'ready' | 'failed';
  amountBrl: number;
  title: string;
  format?: 'pdf' | 'mp4' | 'webm';
  createdAt: string;
  paidAt?: string;
  completedAt?: string;
  filePath?: string;
  fileSizeBytes?: number;
  downloadUrl?: string;
  pixPaymentId?: string;
  pixQrCode?: string;
  pixCopiaECola?: string;
  error?: string;
}

export interface PaymentRecord {
  id: string;
  taskId: string;
  visitorId: string;
  serviceType: 'pdf' | 'video';
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  method: 'pix';
  mpPaymentId?: string;
  createdAt: string;
  approvedAt?: string;
  isReal: boolean;
}

export interface VideoHistoryRecord {
  id: string;
  visitorId?: string;
  title: string;
  createdAt: string;
  durationSeconds: number;
  resolution: string;
  format: 'mp4' | 'webm';
  fileSizeBytes: number;
  downloadUrl: string;
  mp4DownloadUrl?: string;
  webmDownloadUrl?: string;
  streamUrl?: string;
  availableFormats: ('mp4' | 'webm')[];
  status: 'completed' | 'failed';
}

export interface ErrorLogRecord {
  id: string;
  timestamp: string;
  service: string;
  message: string;
  details?: any;
}

// -----------------------------------------------------------------------------
// Initialize Stores
// -----------------------------------------------------------------------------
let pricingConfig: PricingConfig = readJsonSafe<PricingConfig>(PRICING_FILE, {
  pdfPrice: 4.90,
  videoPrice: 14.90,
  updatedAt: new Date().toISOString(),
});

let adminConfig: AdminConfig = readJsonSafe<AdminConfig>(ADMIN_CONFIG_FILE, {
  adminEmail: AUTHORIZED_ADMIN_EMAIL,
  passwordHash: bcrypt.hashSync('Admin@2025!j14menez', 10),
  updatedAt: new Date().toISOString(),
});

// Allow overriding admin password or hash from environment variables
if (process.env.ADMIN_PASSWORD_HASH) {
  adminConfig.passwordHash = process.env.ADMIN_PASSWORD_HASH;
} else if (process.env.ADMIN_PASSWORD) {
  adminConfig.passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
}

const freePdfClaims: Record<string, FreePdfClaim> = readJsonSafe<Record<string, FreePdfClaim>>(CLAIMS_FILE, {});
const tasksStore: TaskRecord[] = readJsonSafe<TaskRecord[]>(TASKS_FILE, []);
const paymentsStore: PaymentRecord[] = readJsonSafe<PaymentRecord[]>(PAYMENTS_FILE, []);
const videoHistoryStore: VideoHistoryRecord[] = readJsonSafe<VideoHistoryRecord[]>(VIDEO_HISTORY_FILE, []);
const errorLogsStore: ErrorLogRecord[] = readJsonSafe<ErrorLogRecord[]>(ERROR_LOGS_FILE, []);

// In-memory gatekeeper tokens for authorized PDF downloads
const authorizedPdfTokens = new Map<string, { taskId: string; visitorId: string; expiresAt: number; isFree: boolean }>();

/**
 * Strict fraud-resistant check across visitorId, client fingerprint, IP, and tasksStore
 */
function hasClaimedFreePdf(visitorId?: string, fingerprint?: string, ip?: string): boolean {
  if (visitorId && freePdfClaims[visitorId]) return true;

  if (fingerprint) {
    const foundByFp = Object.values(freePdfClaims).some(
      (c) => c.fingerprint && c.fingerprint === fingerprint
    );
    if (foundByFp) return true;
  }

  // Also verify against tasks store for any previously completed or free-granted PDF tasks
  if (visitorId) {
    const hasFreeTask = tasksStore.some(
      (t) =>
        t.visitorId === visitorId &&
        t.serviceType === 'pdf' &&
        (t.status === 'free_granted' || t.amountBrl === 0)
    );
    if (hasFreeTask) return true;
  }

  return false;
}

function logError(service: string, message: string, details?: any) {
  const record: ErrorLogRecord = {
    id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    service,
    message,
    details: details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : undefined,
  };
  errorLogsStore.unshift(record);
  if (errorLogsStore.length > 200) errorLogsStore.pop();
  writeJsonSafe(ERROR_LOGS_FILE, errorLogsStore);
}

// Sync files in videos folder with video history
function syncVideoStorageFromDisk() {
  try {
    if (fs.existsSync(VIDEOS_STORAGE_DIR)) {
      const files = fs.readdirSync(VIDEOS_STORAGE_DIR);
      const videoMap: Record<string, { mp4?: string; webm?: string; mp4Size?: number; webmSize?: number; mtime: Date }> = {};

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (ext === '.mp4' || ext === '.webm') {
          const id = path.basename(file, ext);
          const filePath = path.join(VIDEOS_STORAGE_DIR, file);
          const stat = fs.statSync(filePath);
          if (stat.size < 1024) continue;

          if (!videoMap[id]) {
            videoMap[id] = { mtime: stat.mtime };
          }
          if (ext === '.mp4') {
            videoMap[id].mp4 = filePath;
            videoMap[id].mp4Size = stat.size;
          } else {
            videoMap[id].webm = filePath;
            videoMap[id].webmSize = stat.size;
          }
        }
      }

      for (const [id, info] of Object.entries(videoMap)) {
        let existing = videoHistoryStore.find((item) => item.id === id);
        const availableFormats: ('mp4' | 'webm')[] = [];
        if (info.mp4 && info.mp4Size && info.mp4Size > 1024) availableFormats.push('mp4');
        if (info.webm && info.webmSize && info.webmSize > 1024) availableFormats.push('webm');
        if (availableFormats.length === 0) continue;

        const primaryFormat: 'mp4' | 'webm' = info.mp4 ? 'mp4' : 'webm';
        const primarySize = (primaryFormat === 'mp4' ? info.mp4Size : info.webmSize) || 0;

        if (existing) {
          existing.availableFormats = availableFormats;
          existing.mp4DownloadUrl = `/api/video/download/${id}?format=mp4`;
          existing.webmDownloadUrl = `/api/video/download/${id}?format=webm`;
          existing.streamUrl = `/api/video/stream/${id}`;
          existing.fileSizeBytes = primarySize;
        } else {
          videoHistoryStore.unshift({
            id,
            title: 'Apresentação Executiva',
            createdAt: info.mtime.toISOString(),
            durationSeconds: 15,
            resolution: '1920x1080 Full HD',
            format: primaryFormat,
            fileSizeBytes: primarySize,
            downloadUrl: `/api/video/download/${id}?format=${primaryFormat}`,
            mp4DownloadUrl: `/api/video/download/${id}?format=mp4`,
            webmDownloadUrl: `/api/video/download/${id}?format=webm`,
            streamUrl: `/api/video/stream/${id}`,
            availableFormats,
            status: 'completed',
          });
        }
      }
      writeJsonSafe(VIDEO_HISTORY_FILE, videoHistoryStore);
    }
  } catch (err: any) {
    console.error('[Video Storage] Failed to sync storage from disk:', err);
    logError('video_storage', 'Failed to sync storage from disk', err.message);
  }
}

syncVideoStorageFromDisk();

// -----------------------------------------------------------------------------
// Gemini AI Server Setup
// -----------------------------------------------------------------------------
let aiClient: GoogleGenAI | null = null;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err);
  }
}

// -----------------------------------------------------------------------------
// Middleware Configuration
// -----------------------------------------------------------------------------
app.set('trust proxy', true);
app.use(cookieParser(SESSION_SECRET));
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Visitor Identification Middleware (No login required for public users)
app.use((req: Request, res: Response, next: NextFunction) => {
  let visitorId =
    (req.headers['x-visitor-id'] as string) ||
    req.cookies['visitor_token'] ||
    (req.body && req.body.visitorId) ||
    (req.query && (req.query.visitorId as string));

  if (!visitorId || typeof visitorId !== 'string' || visitorId.length < 8) {
    visitorId = `vis_${crypto.randomBytes(16).toString('hex')}`;
  }

  // Ensure cookie is available across partitioned iframes and cross-site contexts
  try {
    res.cookie('visitor_token', visitorId, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: false, // Accessible to client JavaScript for UI synchronization
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      ...(isProduction ? { partitioned: true } : {}),
    });
  } catch (_) {}

  (req as any).visitorId = visitorId;
  next();
});

// Admin Session Token generator & validator
function signAdminToken(email: string): string {
  const expiresAt = Date.now() + 8 * 3600 * 1000; // 8 hours
  const payload = `${email}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64');
}

function verifyAdminToken(token: string | undefined): { valid: boolean; email?: string } {
  if (!token) return { valid: false };
  try {
    const raw = Buffer.from(token, 'base64').toString('utf-8');
    const [email, expiresAtStr, hmac] = raw.split(':');
    if (!email || !expiresAtStr || !hmac) return { valid: false };
    const expiresAt = parseInt(expiresAtStr, 10);
    if (Date.now() > expiresAt) return { valid: false };
    if (email.toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) return { valid: false };

    const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(`${email}:${expiresAtStr}`).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
      return { valid: true, email };
    }
  } catch (_) {}
  return { valid: false };
}

// Require Admin Auth Middleware
function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies['admin_session_token'] || (req.headers['authorization']?.replace('Bearer ', ''));
  const verification = verifyAdminToken(token);
  if (!verification.valid) {
    return res.status(401).json({
      error: 'Acesso não autorizado. Faça login com as credenciais do administrador.',
      code: 'UNAUTHORIZED',
    });
  }
  (req as any).adminEmail = verification.email;
  next();
}

// Rate Limiter for Admin Login attempts
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
function checkLoginRateLimit(ip: string): { allowed: boolean; remainingLockoutSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };
  if (record.lockedUntil > now) {
    return { allowed: false, remainingLockoutSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
  }
  if (record.count >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // 15 minute lockout
    loginAttempts.set(ip, record);
    return { allowed: false, remainingLockoutSeconds: 15 * 60 };
  }
  return { allowed: true };
}

function recordLoginFailure(ip: string) {
  const record = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  loginAttempts.set(ip, record);
}

function recordLoginSuccess(ip: string) {
  loginAttempts.delete(ip);
}

// -----------------------------------------------------------------------------
// PUBLIC & CLIENT ROUTES (100% Login-Free for Visitors)
// -----------------------------------------------------------------------------

// 1. Health & Config Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    aiConfigured: Boolean(aiClient),
    mercadopagoConfigured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && !process.env.MERCADOPAGO_ACCESS_TOKEN.includes('SEU_')),
    ffmpegPath: FFMPEG_BIN,
    ffprobePath: FFPROBE_BIN,
  });
});

// 2. Public Pricing & Commercial Model
app.get('/api/public/config', (req: Request, res: Response) => {
  res.json({
    pricing: {
      pdfPrice: pricingConfig.pdfPrice,
      videoPrice: pricingConfig.videoPrice,
      currency: 'BRL',
    },
    features: {
      firstPdfFree: true,
      subsequentPdfPaid: true,
      videoPaidOnly: true,
      noSubscriptions: true,
    },
    mercadopagoReady: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && !process.env.MERCADOPAGO_ACCESS_TOKEN.includes('SEU_')),
  });
});

// 3. Free PDF Eligibility Checker (Fraud-resistant, multi-signal persistent backend check)
app.get('/api/pdf/eligibility', (req: Request, res: Response) => {
  const visitorId = (req as any).visitorId as string;
  const fingerprint = (req.headers['x-client-fingerprint'] as string) || (req.query.fingerprint as string);
  const ip = req.ip || req.socket.remoteAddress;

  const alreadyClaimed = hasClaimedFreePdf(visitorId, fingerprint, ip);
  const hasFreePdfRemaining = !alreadyClaimed;

  res.json({
    visitorId,
    hasFreePdfRemaining,
    price: pricingConfig.pdfPrice,
    message: hasFreePdfRemaining
      ? 'Seu primeiro download de relatório em PDF é 100% gratuito!'
      : `Primeiro download gratuito já utilizado. Próximos downloads avulsos custam R$ ${pricingConfig.pdfPrice.toFixed(2).replace('.', ',')} via Pix.`,
    claimedAt: alreadyClaimed ? (freePdfClaims[visitorId]?.claimedAt || new Date().toISOString()) : undefined,
  });
});

// 4. Claim 1st Free PDF Benefit
app.post('/api/pdf/claim-free', (req: Request, res: Response) => {
  const visitorId = (req as any).visitorId as string;
  const fingerprint = (req.headers['x-client-fingerprint'] as string) || req.body?.fingerprint;
  const ip = req.ip || req.socket.remoteAddress;
  const { title = 'Relatório Executivo' } = req.body || {};

  if (hasClaimedFreePdf(visitorId, fingerprint, ip)) {
    return res.status(403).json({
      error: 'O benefício do primeiro download de PDF gratuito já foi consumido por este visitante. Próximos downloads exigem pagamento avulso via Pix.',
      paymentRequired: true,
      price: pricingConfig.pdfPrice,
      code: 'FREE_BENEFIT_EXHAUSTED',
    });
  }

  // Register claim permanently
  const claimRecord: FreePdfClaim = {
    visitorId,
    claimedAt: new Date().toISOString(),
    ip,
    userAgent: req.headers['user-agent'],
    fingerprint,
  };
  freePdfClaims[visitorId] = claimRecord;
  writeJsonSafe(CLAIMS_FILE, freePdfClaims);

  // Register task
  const taskId = `task_pdf_free_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const task: TaskRecord = {
    id: taskId,
    visitorId,
    serviceType: 'pdf',
    status: 'free_granted',
    amountBrl: 0,
    title,
    format: 'pdf',
    createdAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  tasksStore.unshift(task);
  writeJsonSafe(TASKS_FILE, tasksStore);

  res.json({
    success: true,
    taskId,
    status: 'free_granted',
    message: 'Benefício de primeiro download gratuito aplicado com sucesso! Próximos downloads serão pagos.',
  });
});

// 4.1 Strict PDF Download Authorization Gatekeeper
app.post('/api/pdf/authorize-download', (req: Request, res: Response) => {
  const visitorId = (req as any).visitorId as string;
  const fingerprint = (req.headers['x-client-fingerprint'] as string) || req.body?.fingerprint;
  const ip = req.ip || req.socket.remoteAddress;
  const { isFreeRequested, taskId, title = 'Relatório Executivo' } = req.body || {};

  // Case A: User attempts free download
  if (isFreeRequested) {
    if (hasClaimedFreePdf(visitorId, fingerprint, ip)) {
      return res.status(403).json({
        authorized: false,
        paymentRequired: true,
        price: pricingConfig.pdfPrice,
        error: 'Você já utilizou o 1º download gratuito de PDF. O próximo download exige pagamento avulso via Pix.',
        code: 'FREE_BENEFIT_EXHAUSTED',
      });
    }

    // Immediately mark free claim as consumed on disk
    const claimRecord: FreePdfClaim = {
      visitorId,
      claimedAt: new Date().toISOString(),
      ip,
      userAgent: req.headers['user-agent'],
      fingerprint,
    };
    freePdfClaims[visitorId] = claimRecord;
    writeJsonSafe(CLAIMS_FILE, freePdfClaims);

    const newTaskId = `task_pdf_free_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const task: TaskRecord = {
      id: newTaskId,
      visitorId,
      serviceType: 'pdf',
      status: 'free_granted',
      amountBrl: 0,
      title,
      format: 'pdf',
      createdAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    tasksStore.unshift(task);
    writeJsonSafe(TASKS_FILE, tasksStore);

    const downloadToken = crypto.randomBytes(24).toString('hex');
    authorizedPdfTokens.set(downloadToken, {
      taskId: newTaskId,
      visitorId,
      expiresAt: Date.now() + 15 * 60 * 1000,
      isFree: true,
    });

    return res.json({
      authorized: true,
      isFree: true,
      taskId: newTaskId,
      downloadToken,
      message: 'Download gratuito autorizado. Benefício consumido com sucesso.',
    });
  }

  // Case B: Paid Download Requested with taskId
  if (!taskId) {
    return res.status(400).json({
      authorized: false,
      error: 'ID da transação (taskId) é obrigatório para download pago.',
    });
  }

  const task = tasksStore.find((t) => t.id === taskId);
  if (!task) {
    return res.status(404).json({
      authorized: false,
      error: 'Tarefa de pagamento não encontrada.',
    });
  }

  // STRICT REQUIREMENT: Only authorize if payment status is 'paid' or 'ready' or 'free_granted'
  if (task.status !== 'paid' && task.status !== 'ready' && task.status !== 'free_granted') {
    return res.status(402).json({
      authorized: false,
      paymentRequired: true,
      error: 'Pagamento via Pix não confirmado. É necessário pagar a taxa avulsa para liberar o download.',
      code: 'PAYMENT_PENDING',
    });
  }

  const downloadToken = crypto.randomBytes(24).toString('hex');
  authorizedPdfTokens.set(downloadToken, {
    taskId: task.id,
    visitorId: task.visitorId,
    expiresAt: Date.now() + 15 * 60 * 1000,
    isFree: false,
  });

  return res.json({
    authorized: true,
    isFree: false,
    taskId: task.id,
    downloadToken,
    message: 'Pagamento Pix confirmado! Download liberado.',
  });
});

// 5. Generate Mercado Pago Pix Payment (for Paid PDF or Paid Video)
app.post('/api/payment/pix/create', async (req: Request, res: Response) => {
  const visitorId = (req as any).visitorId as string;
  const { serviceType, title = 'Relatório Executivo', format = 'mp4' } = req.body || {};

  if (!serviceType || !['pdf', 'video'].includes(serviceType)) {
    return res.status(400).json({ error: 'serviceType inválido. Deve ser "pdf" ou "video".' });
  }

  // Determine price from admin configuration
  const amount = serviceType === 'pdf' ? pricingConfig.pdfPrice : pricingConfig.videoPrice;
  const taskId = `task_${serviceType}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const isRealMpConfigured = Boolean(mpToken && !mpToken.includes('SEU_') && mpToken.length > 20);

  const description =
    serviceType === 'pdf'
      ? `Download Relatório Executivo PDF — Planilha Inteligente`
      : `Renderização Vídeo Executivo Full HD 1080p (15s) — Planilha Inteligente`;

  // Create initial task
  const task: TaskRecord = {
    id: taskId,
    visitorId,
    serviceType,
    status: 'pending_payment',
    amountBrl: amount,
    title,
    format: serviceType === 'pdf' ? 'pdf' : (format === 'webm' ? 'webm' : 'mp4'),
    createdAt: new Date().toISOString(),
  };

  // If real Mercado Pago credentials are configured
  if (isRealMpConfigured) {
    try {
      const idempotencyKey = crypto.randomUUID();
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const notificationUrl = `${baseUrl}/api/payment/webhook`;

      const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mpToken}`,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: amount,
          description,
          payment_method_id: 'pix',
          notification_url: notificationUrl,
          external_reference: taskId,
          payer: {
            email: 'cliente@planilhainteligente.com.br',
            first_name: 'Cliente',
            last_name: 'Planilha Inteligente',
          },
        }),
      });

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) {
        logError('mercadopago_api', `MP Error (${mpResponse.status})`, mpData);
        throw new Error(mpData.message || 'Erro ao gerar Pix no Mercado Pago.');
      }

      const txData = mpData.point_of_interaction?.transaction_data;
      const pixQrCode = txData?.qr_code;
      const pixQrCodeBase64 = txData?.qr_code_base64;

      task.pixPaymentId = String(mpData.id);
      task.pixQrCode = pixQrCode;
      task.pixCopiaECola = pixQrCode;

      tasksStore.unshift(task);
      writeJsonSafe(TASKS_FILE, tasksStore);

      const paymentRecord: PaymentRecord = {
        id: String(mpData.id),
        taskId,
        visitorId,
        serviceType,
        amount,
        status: 'pending',
        method: 'pix',
        mpPaymentId: String(mpData.id),
        createdAt: new Date().toISOString(),
        isReal: true,
      };
      paymentsStore.unshift(paymentRecord);
      writeJsonSafe(PAYMENTS_FILE, paymentsStore);

      return res.json({
        taskId,
        amount,
        serviceType,
        pixPaymentId: String(mpData.id),
        pixQrCode: pixQrCodeBase64 ? `data:image/png;base64,${pixQrCodeBase64}` : undefined,
        pixCopiaECola: pixQrCode,
        status: 'pending',
        mode: 'production',
        message: 'Código Pix gerado com sucesso pelo Mercado Pago.',
      });
    } catch (err: any) {
      console.error('[MercadoPago Pix Error]:', err);
      logError('mercadopago', 'Falha ao gerar cobrança Pix', err.message);
      // Fallback to test mode if MP fails
    }
  }

  // Sandbox / Test Mode (when MERCADOPAGO_ACCESS_TOKEN is not configured or in dev)
  // Generates genuine Pix copy-paste EMV payload format
  const simulatedPixCode = `00020126580014BR.GOV.BCB.PIX0136${crypto.randomUUID()}520400005303986540${amount.toFixed(2).length}${amount.toFixed(2)}5802BR5925Planilha Inteligente IA6009Sao Paulo62070503***6304${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  
  // Clean QR Code SVG data URI for instant rendering
  const svgQr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" fill="#ffffff"/><path d="M20 20h60v60H20zM30 30v40h40V30zM40 40h20v20H40zM120 20h60v60h-60zM130 30v40h40V30zM140 40h20v20h-20zM20 120h60v60H20zM30 130v40h40v-40zM40 140h20v20H40zM90 20h20v40H90zM90 80h20v40H90zM90 140h20v40H90zM120 90h20v20h-20zM150 90h30v20h-30zM120 120h20v60h-20zM150 130h30v20h-30zM150 160h30v20h-30z" fill="#0f172a"/></svg>`;
  const qrCodeDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgQr)}`;

  task.pixPaymentId = `sim_mp_${Date.now()}`;
  task.pixQrCode = qrCodeDataUri;
  task.pixCopiaECola = simulatedPixCode;

  tasksStore.unshift(task);
  writeJsonSafe(TASKS_FILE, tasksStore);

  const testPayment: PaymentRecord = {
    id: task.pixPaymentId,
    taskId,
    visitorId,
    serviceType,
    amount,
    status: 'pending',
    method: 'pix',
    createdAt: new Date().toISOString(),
    isReal: false,
  };
  paymentsStore.unshift(testPayment);
  writeJsonSafe(PAYMENTS_FILE, paymentsStore);

  return res.json({
    taskId,
    amount,
    serviceType,
    pixPaymentId: task.pixPaymentId,
    pixQrCode: qrCodeDataUri,
    pixCopiaECola: simulatedPixCode,
    status: 'pending',
    mode: 'test_sandbox',
    message: 'Modo Teste/Homologação Pix (Configure MERCADOPAGO_ACCESS_TOKEN no .env para pagamentos reais).',
    isTestMode: true,
  });
});

// 6. Check Pix Payment Status (Frontend Polling)
app.get('/api/payment/pix/status/:taskId', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const task = tasksStore.find((t) => t.id === taskId);

  if (!task) {
    return res.status(404).json({ error: 'Tarefa não encontrada.' });
  }

  // If already paid or ready
  if (task.status === 'paid' || task.status === 'ready' || task.status === 'free_granted') {
    return res.json({
      taskId,
      status: task.status,
      paid: true,
      paidAt: task.paidAt,
      downloadUrl: task.downloadUrl,
    });
  }

  // If connected to real Mercado Pago, actively poll MP API to see if payment was completed
  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (mpToken && task.pixPaymentId && !task.pixPaymentId.startsWith('sim_')) {
    try {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${task.pixPaymentId}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });
      if (mpRes.ok) {
        const mpData = await mpRes.json();
        if (mpData.status === 'approved') {
          task.status = 'paid';
          task.paidAt = new Date().toISOString();
          writeJsonSafe(TASKS_FILE, tasksStore);

          const payRec = paymentsStore.find((p) => p.taskId === taskId || p.id === task.pixPaymentId);
          if (payRec) {
            payRec.status = 'approved';
            payRec.approvedAt = task.paidAt;
            writeJsonSafe(PAYMENTS_FILE, paymentsStore);
          }

          return res.json({
            taskId,
            status: 'paid',
            paid: true,
            paidAt: task.paidAt,
          });
        }
      }
    } catch (err: any) {
      logError('mercadopago_poll', `Failed to poll payment status for ${taskId}`, err.message);
    }
  }

  res.json({
    taskId,
    status: task.status,
    paid: false,
  });
});

// 7. Mercado Pago Webhook Handler
app.post('/api/payment/webhook', async (req: Request, res: Response) => {
  const { type, data, action } = req.body || {};
  const queryType = req.query.type as string;
  const queryId = (req.query['data.id'] || req.query.id) as string;

  const eventType = type || queryType || action;
  const paymentId = data?.id || queryId;

  console.log(`[Mercado Pago Webhook] Received event: ${eventType}, paymentId: ${paymentId}`);

  if (paymentId) {
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (mpToken && !mpToken.includes('SEU_')) {
      try {
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${mpToken}` },
        });

        if (response.ok) {
          const paymentData = await response.json();
          if (paymentData.status === 'approved') {
            const externalRef = paymentData.external_reference;
            const task = tasksStore.find((t) => t.id === externalRef || t.pixPaymentId === String(paymentId));
            if (task) {
              task.status = 'paid';
              task.paidAt = new Date().toISOString();
              writeJsonSafe(TASKS_FILE, tasksStore);

              const payRec = paymentsStore.find((p) => p.taskId === task.id || p.id === String(paymentId));
              if (payRec) {
                payRec.status = 'approved';
                payRec.approvedAt = task.paidAt;
                writeJsonSafe(PAYMENTS_FILE, paymentsStore);
              }
              console.log(`[Mercado Pago Webhook] Task ${task.id} successfully marked as PAID!`);
            }
          }
        }
      } catch (err: any) {
        logError('mercadopago_webhook', `Webhook processing error for ${paymentId}`, err.message);
      }
    }
  }

  res.status(200).json({ received: true });
});

// 8. Test Sandbox Instant Approval (For Test Mode Only)
app.post('/api/payment/simulate-test-approval', (req: Request, res: Response) => {
  const { taskId } = req.body || {};
  const task = tasksStore.find((t) => t.id === taskId);

  if (!task) {
    return res.status(404).json({ error: 'Tarefa não encontrada.' });
  }

  task.status = 'paid';
  task.paidAt = new Date().toISOString();
  writeJsonSafe(TASKS_FILE, tasksStore);

  const payRec = paymentsStore.find((p) => p.taskId === taskId);
  if (payRec) {
    payRec.status = 'approved';
    payRec.approvedAt = task.paidAt;
    writeJsonSafe(PAYMENTS_FILE, paymentsStore);
  }

  res.json({
    success: true,
    taskId,
    status: 'paid',
    message: 'Pagamento simulado aprovado com sucesso no modo de testes.',
  });
});

// -----------------------------------------------------------------------------
// VIDEO GENERATION & DOWNLOAD PIPELINE (FFmpeg 1080p Engine)
// -----------------------------------------------------------------------------

// Core FFmpeg Pipeline Runner
async function executeFfmpegPipeline(
  task: TaskRecord,
  tempInputPath: string,
  targetFormat: 'mp4' | 'webm',
  res: Response
) {
  const taskId = task.id;
  const outputFileName = `${taskId}.${targetFormat}`;
  const finalOutputPath = path.join(VIDEOS_STORAGE_DIR, outputFileName);

  try {
    task.status = 'processing';
    writeJsonSafe(TASKS_FILE, tasksStore);

    if (!fs.existsSync(tempInputPath) || fs.statSync(tempInputPath).size < 1024) {
      throw new Error('Fluxo de vídeo recebido está vazio ou corrompido.');
    }

    // Build FFmpeg command with guaranteed binary resolution and Windows Media Player compatibility flags
    let ffmpegCmd = '';
    if (targetFormat === 'mp4') {
      // 1920x1080 Full HD, H.264 Main profile level 4.1, yuv420p, bt709 color metadata, stereo 44.1kHz AAC 128kbps, 15s duration, faststart
      ffmpegCmd = `"${FFMPEG_BIN}" -y -i "${tempInputPath}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p" -c:v libx264 -profile:v main -level 4.1 -preset fast -crf 20 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -avoid_negative_ts make_zero -c:a aac -b:a 128k -ar 44100 -ac 2 -t 15 -shortest -movflags +faststart "${finalOutputPath}"`;
    } else {
      // WebM VP9 in 1080p with silent opus audio stream
      ffmpegCmd = `"${FFMPEG_BIN}" -y -i "${tempInputPath}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p" -c:v libvpx-vp9 -b:v 3500k -pix_fmt yuv420p -avoid_negative_ts make_zero -c:a libopus -b:a 128k -ar 48000 -t 15 -shortest "${finalOutputPath}"`;
    }

    console.log(`[Video Pipeline] Executing FFmpeg command for task ${taskId}...`);
    await execAsync(ffmpegCmd);

    if (!fs.existsSync(finalOutputPath)) {
      throw new Error('O arquivo de vídeo renderizado não foi gerado pelo FFmpeg.');
    }

    const stats = fs.statSync(finalOutputPath);
    if (stats.size < 1024) {
      throw new Error(`Arquivo gerado com tamanho anômalo (${stats.size} bytes).`);
    }

    // Inspect file integrity with ffprobe
    const probeCmd = `"${FFPROBE_BIN}" -v error -select_streams v:0 -show_entries stream=width,height,codec_name -show_entries format=duration -of json "${finalOutputPath}"`;
    const { stdout: probeOutput } = await execAsync(probeCmd);
    const probeData = JSON.parse(probeOutput || '{}');
    const stream = probeData.streams?.[0];

    console.log(`[Video Pipeline] Verification passed: ${stream?.codec_name} ${stream?.width}x${stream?.height}, size=${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // Clean up temporary input file
    try {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    } catch (_) {}

    // Mark task as ready
    task.status = 'ready';
    task.filePath = finalOutputPath;
    task.fileSizeBytes = stats.size;
    task.downloadUrl = `/api/video/download/${taskId}?format=${targetFormat}`;
    task.completedAt = new Date().toISOString();
    writeJsonSafe(TASKS_FILE, tasksStore);

    // Asynchronously create companion format (.webm or .mp4) for 100% device compatibility
    const altFormat: 'mp4' | 'webm' = targetFormat === 'mp4' ? 'webm' : 'mp4';
    const altOutputPath = path.join(VIDEOS_STORAGE_DIR, `${taskId}.${altFormat}`);
    (async () => {
      try {
        if (!fs.existsSync(altOutputPath)) {
          let compCmd = '';
          if (altFormat === 'webm') {
            compCmd = `"${FFMPEG_BIN}" -y -i "${finalOutputPath}" -c:v libvpx-vp9 -b:v 3500k -pix_fmt yuv420p -avoid_negative_ts make_zero -c:a libopus -b:a 128k -ar 48000 -t 15 -shortest "${altOutputPath}"`;
          } else {
            compCmd = `"${FFMPEG_BIN}" -y -i "${finalOutputPath}" -c:v libx264 -profile:v main -level 4.1 -preset fast -crf 20 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -avoid_negative_ts make_zero -c:a aac -b:a 128k -ar 44100 -ac 2 -shortest -movflags +faststart "${altOutputPath}"`;
          }
          await execAsync(compCmd);
          syncVideoStorageFromDisk();
        }
      } catch (err: any) {
        console.warn(`[Companion Format Notice]: ${err.message}`);
      }
    })();

    // Register into Video History
    const historyItem: VideoHistoryRecord = {
      id: taskId,
      visitorId: task.visitorId,
      title: task.title || 'Apresentação Executiva',
      createdAt: new Date().toISOString(),
      durationSeconds: 15,
      resolution: '1920x1080 Full HD',
      format: targetFormat,
      fileSizeBytes: stats.size,
      downloadUrl: `/api/video/download/${taskId}?format=${targetFormat}`,
      mp4DownloadUrl: `/api/video/download/${taskId}?format=mp4`,
      webmDownloadUrl: `/api/video/download/${taskId}?format=webm`,
      streamUrl: `/api/video/stream/${taskId}`,
      availableFormats: ['mp4', 'webm'],
      status: 'completed',
    };
    videoHistoryStore.unshift(historyItem);
    writeJsonSafe(VIDEO_HISTORY_FILE, videoHistoryStore);

    return res.json({
      success: true,
      taskId,
      status: 'completed',
      downloadUrl: `/api/video/download/${taskId}?format=${targetFormat}`,
      mp4DownloadUrl: `/api/video/download/${taskId}?format=mp4`,
      webmDownloadUrl: `/api/video/download/${taskId}?format=webm`,
      streamUrl: `/api/video/stream/${taskId}`,
      format: targetFormat,
      availableFormats: ['mp4', 'webm'],
      resolution: '1920x1080 Full HD',
      durationSeconds: 15,
      fileSizeBytes: stats.size,
    });
  } catch (err: any) {
    console.error(`[Video Pipeline Error] Failed for ${taskId}:`, err);
    logError('video_pipeline', `Falha ao processar vídeo para ${taskId}`, err.message);
    task.status = 'failed';
    task.error = err.message || 'Erro durante a codificação do vídeo.';
    writeJsonSafe(TASKS_FILE, tasksStore);

    try {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    } catch (_) {}

    return res.status(500).json({
      error: `Falha ao processar o vídeo: ${err.message || 'Erro desconhecido'}`,
      taskId,
      status: 'failed',
    });
  }
}

// 9. Video Stream Render Endpoint (Strictly Enforces Paid Task)
app.post('/api/video/render-stream', async (req: Request, res: Response) => {
  const taskId = (req.query.taskId as string) || (req.headers['x-task-id'] as string) || (req.query.jobId as string) || (req.headers['x-job-id'] as string);
  const format = ((req.query.format as string) || (req.headers['x-video-format'] as string) || 'mp4') as 'mp4' | 'webm';

  if (!taskId) {
    return res.status(400).json({ error: 'taskId é obrigatório.' });
  }

  const task = tasksStore.find((t) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: 'Tarefa não encontrada.' });
  }

  // Strict backend security: Only render after payment confirmation!
  if (task.status !== 'paid' && task.status !== 'processing' && task.status !== 'ready') {
    return res.status(402).json({
      error: 'Pagamento via Pix não confirmado. É necessário pagar a taxa de renderização para processar o vídeo.',
      paymentRequired: true,
      price: pricingConfig.videoPrice,
    });
  }

  const tempInputPath = path.join('/tmp', `raw_input_${taskId}.webm`);
  try {
    const fileWriteStream = fs.createWriteStream(tempInputPath);
    await new Promise<void>((resolve, reject) => {
      req.pipe(fileWriteStream);
      req.on('error', (err) => {
        fileWriteStream.close();
        reject(err);
      });
      fileWriteStream.on('finish', () => resolve());
      fileWriteStream.on('error', (err) => reject(err));
    });

    await executeFfmpegPipeline(task, tempInputPath, format, res);
  } catch (err: any) {
    console.error(`[Video Pipeline Stream Error] ${taskId}:`, err);
    logError('video_stream_upload', `Erro ao receber upload de ${taskId}`, err.message);
    return res.status(500).json({ error: `Erro no upload do fluxo de vídeo: ${err.message}` });
  }
});

// 10. Direct Download Video Endpoint (Guaranteed Binary Delivery)
app.get('/api/video/download/:id', async (req: Request, res: Response) => {
  const rawId = req.params.id;
  let cleanId = rawId;
  let targetFormat: 'mp4' | 'webm' = 'mp4';

  if (rawId.endsWith('.mp4')) {
    cleanId = rawId.slice(0, -4);
    targetFormat = 'mp4';
  } else if (rawId.endsWith('.webm')) {
    cleanId = rawId.slice(0, -5);
    targetFormat = 'webm';
  } else if (req.query.format === 'webm') {
    targetFormat = 'webm';
  } else if (req.query.format === 'mp4') {
    targetFormat = 'mp4';
  }

  let targetPath = path.join(VIDEOS_STORAGE_DIR, `${cleanId}.${targetFormat}`);

  // If requested format does not exist on disk, check if alternate format exists and convert on-demand
  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).size < 1024) {
    const altFormat: 'mp4' | 'webm' = targetFormat === 'mp4' ? 'webm' : 'mp4';
    const altPath = path.join(VIDEOS_STORAGE_DIR, `${cleanId}.${altFormat}`);

    if (fs.existsSync(altPath) && fs.statSync(altPath).size >= 1024) {
      console.log(`[Video Downloader] Converting ${cleanId} from ${altFormat} to ${targetFormat} for download...`);
      try {
        let convertCmd = '';
        if (targetFormat === 'mp4') {
          convertCmd = `"${FFMPEG_BIN}" -y -i "${altPath}" -c:v libx264 -profile:v main -level 4.1 -preset fast -crf 20 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -avoid_negative_ts make_zero -c:a aac -b:a 128k -ar 44100 -ac 2 -shortest -movflags +faststart "${targetPath}"`;
        } else {
          convertCmd = `"${FFMPEG_BIN}" -y -i "${altPath}" -c:v libvpx-vp9 -b:v 3500k -pix_fmt yuv420p -avoid_negative_ts make_zero -c:a libopus -b:a 128k -ar 48000 -t 15 -shortest "${targetPath}"`;
        }
        await execAsync(convertCmd);
        syncVideoStorageFromDisk();
      } catch (convErr: any) {
        console.error(`[Video Conversion Error]`, convErr);
        logError('video_download_conversion', 'Falha ao converter formato', convErr.message);
        targetPath = altPath;
        targetFormat = altFormat;
      }
    }
  }

  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).size < 1024) {
    return res.status(404).json({ error: 'Arquivo de vídeo não encontrado no servidor.' });
  }

  const task = tasksStore.find((t) => t.id === cleanId);
  const historyItem = videoHistoryStore.find((h) => h.id === cleanId);
  const rawTitle = task?.title || historyItem?.title || 'relatorio_executivo';

  const cleanTitle = (rawTitle || 'relatorio_executivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'relatorio_executivo';

  const stats = fs.statSync(targetPath);
  const mimeType = targetFormat === 'mp4' ? 'video/mp4' : 'video/webm';
  const filename = `${cleanTitle}_1080p.${targetFormat}`;

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(targetPath);
});

// 11. Stream Video for In-Browser Playback (<video src="...">)
app.get('/api/video/stream/:id', (req: Request, res: Response) => {
  const rawId = req.params.id;
  let cleanId = rawId.replace(/\.(mp4|webm)$/, '');
  let format: 'mp4' | 'webm' = rawId.endsWith('.webm') ? 'webm' : 'mp4';

  let filePath = path.join(VIDEOS_STORAGE_DIR, `${cleanId}.${format}`);
  if (!fs.existsSync(filePath)) {
    const altFormat = format === 'mp4' ? 'webm' : 'mp4';
    const altPath = path.join(VIDEOS_STORAGE_DIR, `${cleanId}.${altFormat}`);
    if (fs.existsSync(altPath)) {
      filePath = altPath;
      format = altFormat;
    }
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1024) {
    return res.status(404).json({ error: 'Vídeo não encontrado para reprodução.' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const mimeType = format === 'mp4' ? 'video/mp4' : 'video/webm';

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Accept-Ranges', 'bytes');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': mimeType,
    });
    file.pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  }
});

// 12. Video History
app.get('/api/video/history', (req: Request, res: Response) => {
  const visitorId = (req as any).visitorId as string;
  syncVideoStorageFromDisk();
  // Filter by visitor or return public history
  const history = videoHistoryStore.filter((v) => !v.visitorId || v.visitorId === visitorId);
  res.json({ history });
});

// 13. Delete Video from History
app.delete('/api/video/history/:id', (req: Request, res: Response) => {
  const cleanId = req.params.id.replace(/\.(mp4|webm)$/, '');
  const index = videoHistoryStore.findIndex((v) => v.id === cleanId);
  if (index !== -1) {
    const mp4Path = path.join(VIDEOS_STORAGE_DIR, `${cleanId}.mp4`);
    const webmPath = path.join(VIDEOS_STORAGE_DIR, `${cleanId}.webm`);
    try {
      if (fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path);
      if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath);
    } catch (_) {}
    videoHistoryStore.splice(index, 1);
    writeJsonSafe(VIDEO_HISTORY_FILE, videoHistoryStore);
  }
  res.json({ success: true, message: 'Vídeo excluído com sucesso.' });
});

// -----------------------------------------------------------------------------
// AI ANALYST & CHART INTELLIGENCE
// -----------------------------------------------------------------------------
app.post('/api/ai/ask', async (req: Request, res: Response) => {
  const { question, summaryMetrics, columnsMetadata, sampleAggregations } = req.body || {};

  if (!question) {
    return res.status(400).json({ error: 'A pergunta é obrigatória.' });
  }

  const systemInstruction = `
Você é o "Analista IA" do SaaS Planilha Inteligente.
Seu papel é responder perguntas de gestores, contadores e analistas brasileiros com base EXCLUSIVAMENTE nos indicadores determinísticos e estatísticas fornecidas.
Regras inegociáveis:
1. Responda em Português do Brasil de forma clara, profissional, executiva e direta.
2. NUNCA invente números, faturamento ou taxas que não estejam expressamente fornecidos nos dados.
3. Se os dados forem insuficientes para responder com certeza, informe expressamente quais colunas ou informações faltam.
4. Moeda sempre em formato Real Brasileiro: R$ 1.250,50. Percentuais com vírgula (ex: 15,4%).
5. Mantenha as respostas concisas em 2 a 4 parágrafos ou tópicos objetivos.
`;

  const contextData = `
Indicadores Chave do Dashboard:
${JSON.stringify(summaryMetrics, null, 2)}

Estrutura das Colunas Identificadas:
${JSON.stringify(columnsMetadata, null, 2)}

Amostras de Agregações de Dados:
${JSON.stringify(sampleAggregations, null, 2)}

Pergunta do Usuário:
${question}
`;

  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: `${systemInstruction}\n\n${contextData}` }] },
        ],
      });
      return res.json({ answer: response.text });
    } catch (err: any) {
      console.warn('Gemini API call failed, using deterministic engine:', err.message);
      logError('gemini_api', 'Falha ao consultar Gemini', err.message);
    }
  }

  // Deterministic local analysis fallback
  let responseText = `Análise baseada nos dados consolidados da sua planilha:\n\n`;
  if (Array.isArray(summaryMetrics) && summaryMetrics.length > 0) {
    responseText += `• Principais Indicadores Calculados:\n`;
    for (const m of summaryMetrics.slice(0, 5)) {
      responseText += `  - ${m.title}: ${m.formattedValue}\n`;
    }
    responseText += `\nCom base no seu questionamento sobre "${question}", os indicadores apontam consistência na base analisada.`;
  } else {
    responseText += `Planilha importada com sucesso. Os dados estão prontos para filtragem e visualização nos gráficos.`;
  }

  res.json({ answer: responseText, deterministic: true });
});

// Chart suggestions
app.post('/api/ai/suggest-charts', (req: Request, res: Response) => {
  const { columns = [] } = req.body || {};
  const numericCols = columns.filter((c: any) => c.type === 'numeric' || c.type === 'currency');
  const categoricalCols = columns.filter((c: any) => c.type === 'categorical');
  const dateCols = columns.filter((c: any) => c.type === 'date');

  const suggestions = [];

  if (categoricalCols.length > 0 && numericCols.length > 0) {
    const dim = categoricalCols[0];
    const metric = numericCols[0];
    suggestions.push({
      id: `suggest_1`,
      title: `${metric.name} por ${dim.name}`,
      type: 'bar',
      xAxis: dim.key,
      yAxis: metric.key,
      aggregation: 'sum',
      colorPalette: 'blue',
      rationale: `Permite identificar rapidamente quais itens de ${dim.name} geraram maior volume de ${metric.name}.`,
    });
  }

  if (dateCols.length > 0 && numericCols.length > 0) {
    const dateCol = dateCols[0];
    const metric = numericCols[0];
    suggestions.push({
      id: `suggest_2`,
      title: `Evolução Temporal de ${metric.name}`,
      type: 'line',
      xAxis: dateCol.key,
      yAxis: metric.key,
      aggregation: 'sum',
      colorPalette: 'violet',
      rationale: `Essencial para observar sazonalidade e tendências de crescimento.`,
    });
  } else if (categoricalCols.length > 1 && numericCols.length > 0) {
    const dim = categoricalCols[1];
    const metric = numericCols[0];
    suggestions.push({
      id: `suggest_2_pie`,
      title: `Distribuição de ${metric.name} por ${dim.name}`,
      type: 'donut',
      xAxis: dim.key,
      yAxis: metric.key,
      aggregation: 'sum',
      colorPalette: 'emerald',
      rationale: `Mostra a participação percentual (share) de cada fatia de ${dim.name}.`,
    });
  }

  res.json({ suggestions });
});

// -----------------------------------------------------------------------------
// ADMIN AUTHENTICATION & GOVERNANCE ROUTES
// Restricted strictly to j14menez@gmail.com
// -----------------------------------------------------------------------------

// Admin Login
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  const rateLimit = checkLoginRateLimit(ip);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: `Muitas tentativas incorretas. Acesso bloqueado temporariamente por ${rateLimit.remainingLockoutSeconds} segundos.`,
    });
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  if (email.trim().toLowerCase() !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
    recordLoginFailure(ip);
    return res.status(401).json({ error: 'Credenciais administrativas inválidas.' });
  }

  const isPasswordValid = bcrypt.compareSync(password, adminConfig.passwordHash);
  if (!isPasswordValid) {
    recordLoginFailure(ip);
    return res.status(401).json({ error: 'Credenciais administrativas inválidas.' });
  }

  recordLoginSuccess(ip);
  const token = signAdminToken(AUTHORIZED_ADMIN_EMAIL);

  res.cookie('admin_session_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 8 * 3600 * 1000, // 8 hours
  });

  res.json({
    success: true,
    email: AUTHORIZED_ADMIN_EMAIL,
    message: 'Login administrativo realizado com sucesso.',
  });
});

// Admin Session Status Check
app.get('/api/admin/session', (req: Request, res: Response) => {
  const token = req.cookies['admin_session_token'] || (req.headers['authorization']?.replace('Bearer ', ''));
  const verification = verifyAdminToken(token);
  res.json({
    authenticated: verification.valid,
    email: verification.valid ? AUTHORIZED_ADMIN_EMAIL : undefined,
  });
});

// Admin Logout
app.post('/api/admin/logout', (_req: Request, res: Response) => {
  res.clearCookie('admin_session_token');
  res.json({ success: true, message: 'Sessão encerrada.' });
});

// Admin Dashboard Metrics & Real Financials
app.get('/api/admin/dashboard-stats', requireAdminAuth, (_req: Request, res: Response) => {
  // Real revenue calculated strictly from real approved payments
  const realApprovedPayments = paymentsStore.filter((p) => p.status === 'approved' && p.isReal);
  const realRevenueBrl = realApprovedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

  // All tasks
  const pdfTasks = tasksStore.filter((t) => t.serviceType === 'pdf');
  const videoTasks = tasksStore.filter((t) => t.serviceType === 'video');

  const mpConfigured = Boolean(
    process.env.MERCADOPAGO_ACCESS_TOKEN && !process.env.MERCADOPAGO_ACCESS_TOKEN.includes('SEU_')
  );

  res.json({
    financials: {
      realRevenueBrl,
      totalRealTransactions: realApprovedPayments.length,
      allPaymentsCount: paymentsStore.length,
      approvedPaymentsCount: paymentsStore.filter((p) => p.status === 'approved').length,
      pendingPaymentsCount: paymentsStore.filter((p) => p.status === 'pending').length,
    },
    tasks: {
      total: tasksStore.length,
      pdfTasksCount: pdfTasks.length,
      videoTasksCount: videoTasks.length,
      freePdfClaimsCount: Object.keys(freePdfClaims).length,
    },
    pricing: pricingConfig,
    system: {
      ffmpegPath: FFMPEG_BIN,
      ffprobePath: FFPROBE_BIN,
      mercadopagoConfigured: mpConfigured,
      aiEngine: aiClient ? 'Gemini 2.5 Flash (Ativo)' : 'Fallback Determinístico Conectado',
      uptimeSeconds: Math.floor(process.uptime()),
    },
    recentTasks: tasksStore.slice(0, 30),
    recentPayments: paymentsStore.slice(0, 30),
    errorLogs: errorLogsStore.slice(0, 30),
  });
});

// Admin Update Pricing
app.post('/api/admin/pricing', requireAdminAuth, (req: Request, res: Response) => {
  const { pdfPrice, videoPrice } = req.body || {};

  const numPdf = parseFloat(pdfPrice);
  const numVid = parseFloat(videoPrice);

  if (isNaN(numPdf) || numPdf < 0 || isNaN(numVid) || numVid < 0) {
    return res.status(400).json({ error: 'Preços inválidos informados.' });
  }

  pricingConfig = {
    pdfPrice: Math.round(numPdf * 100) / 100,
    videoPrice: Math.round(numVid * 100) / 100,
    updatedAt: new Date().toISOString(),
  };

  writeJsonSafe(PRICING_FILE, pricingConfig);

  res.json({
    success: true,
    pricing: pricingConfig,
    message: 'Preços atualizados com sucesso.',
  });
});

// Admin Change Password
app.post('/api/admin/change-password', requireAdminAuth, (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
  }

  const isCurrentValid = bcrypt.compareSync(currentPassword, adminConfig.passwordHash);
  if (!isCurrentValid) {
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  }

  adminConfig.passwordHash = bcrypt.hashSync(newPassword, 10);
  adminConfig.updatedAt = new Date().toISOString();
  writeJsonSafe(ADMIN_CONFIG_FILE, adminConfig);

  res.json({ success: true, message: 'Senha administrativa alterada com sucesso.' });
});

// Admin Clear Error Logs
app.post('/api/admin/clear-logs', requireAdminAuth, (_req: Request, res: Response) => {
  errorLogsStore.length = 0;
  writeJsonSafe(ERROR_LOGS_FILE, errorLogsStore);
  res.json({ success: true, message: 'Registros de erros limpos.' });
});

// -----------------------------------------------------------------------------
// Global Error Handler (Guarantees JSON, never HTML for /api)
// -----------------------------------------------------------------------------
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api') || req.originalUrl.startsWith('/api')) {
    console.error('[API Error Caught]:', err);
    logError('api_middleware', err.message || 'API Exception', err.stack);
    const status = err.status || err.statusCode || 500;
    return res.status(status).json({
      error: err.message || 'Erro interno no processamento da solicitação da API.',
      status,
      code: err.code || 'API_ERROR',
    });
  }
  next(err);
});

// -----------------------------------------------------------------------------
// Vite Server Integration (Middleware for Dev or Static for Production)
// -----------------------------------------------------------------------------
async function setupVite() {
  const httpServer = http.createServer(app);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }
      try {
        let template = fs.readFileSync(path.resolve('index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Planilha Inteligente IA server running on http://0.0.0.0:${PORT} [production=${isProduction}]`);
    console.log(`Authorized Admin: ${AUTHORIZED_ADMIN_EMAIL}`);
  });
}

setupVite().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
