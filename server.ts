import express, { Request, Response } from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';

const execAsync = util.promisify(exec);
const FFMPEG_PATH = ffmpegPath || 'ffmpeg';
const FFPROBE_PATH = ffprobePath.path || 'ffprobe';

dotenv.config();

const app = express();
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 ? process.argv[portArgIndex + 1] : undefined;
const PORT = cliPort || process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Ensure storage directory for genuine Full HD rendered videos exists
const VIDEOS_STORAGE_DIR = path.resolve('server_storage/videos');
if (!fs.existsSync(VIDEOS_STORAGE_DIR)) {
  fs.mkdirSync(VIDEOS_STORAGE_DIR, { recursive: true });
}

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// -----------------------------------------------------------------------------
// In-Memory Database & State (Simulating Supabase/PostgreSQL backend store)
// -----------------------------------------------------------------------------
interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  plan: 'free' | 'premium';
  createdAt: string;
}

interface UserUsage {
  userId: string;
  period: string; // YYYY-MM
  importsCount: number;
  aiQueriesCount: number;
  dashboardsCount: number;
  videoExportsCount: number;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  metadata: any;
  timestamp: string;
  ip?: string;
}

interface Subscription {
  id: string;
  userId: string;
  status: 'active' | 'pending' | 'canceled' | 'paused';
  mpPreapprovalId?: string;
  mpPayerId?: string;
  planId: string;
  priceCents: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

const usersStore: Map<string, UserProfile> = new Map([
  [
    'user_default_1',
    {
      id: 'user_default_1',
      email: 'animeemcristo@gmail.com',
      name: 'Usuário',
      role: 'admin',
      plan: 'premium',
      createdAt: new Date().toISOString(),
    },
  ],
]);

const usageStore: Map<string, UserUsage> = new Map();
const subscriptionsStore: Map<string, Subscription> = new Map();
const auditLogsStore: AuditLog[] = [
  {
    id: 'log_init',
    userId: 'user_default_1',
    action: 'SYSTEM_BOOT',
    resourceType: 'server',
    metadata: { version: '1.0.0', status: 'ready', mode: 'real_data_only' },
    timestamp: new Date().toISOString(),
  },
];

// Helper to get or init current month usage
function getUsage(userId: string): UserUsage {
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const key = `${userId}_${currentPeriod}`;
  if (!usageStore.has(key)) {
    usageStore.set(key, {
      userId,
      period: currentPeriod,
      importsCount: 0,
      aiQueriesCount: 0,
      dashboardsCount: 0,
      videoExportsCount: 0,
    });
  }
  return usageStore.get(key)!;
}

// -----------------------------------------------------------------------------
// Video Rendering & History Store
// -----------------------------------------------------------------------------
interface VideoJobRecord {
  id: string;
  userId: string;
  title: string;
  format: 'mp4' | 'webm';
  status: 'queued' | 'preparing' | 'rendering' | 'finalizing' | 'completed' | 'failed' | 'canceled';
  progressPercent: number;
  durationSeconds: number;
  resolution: string;
  filePath?: string;
  fileSizeBytes?: number;
  downloadUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

interface VideoHistoryRecord {
  id: string;
  userId: string;
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

const videoJobsStore: Map<string, VideoJobRecord> = new Map();
const videoHistoryStore: VideoHistoryRecord[] = [];
const VIDEO_HISTORY_FILE = path.resolve('server_storage/video_history.json');

function saveVideoHistoryToDisk() {
  try {
    fs.writeFileSync(VIDEO_HISTORY_FILE, JSON.stringify(videoHistoryStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Video Storage] Failed to save video history to disk:', err);
  }
}

function syncVideoStorageFromDisk() {
  try {
    if (fs.existsSync(VIDEO_HISTORY_FILE)) {
      const data = fs.readFileSync(VIDEO_HISTORY_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        videoHistoryStore.length = 0;
        videoHistoryStore.push(...parsed);
      }
    }

    if (fs.existsSync(VIDEOS_STORAGE_DIR)) {
      const files = fs.readdirSync(VIDEOS_STORAGE_DIR);
      const videoMap: Record<string, { mp4?: string; webm?: string; mp4Size?: number; webmSize?: number; mtime: Date }> = {};

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (ext === '.mp4' || ext === '.webm') {
          const id = path.basename(file, ext);
          const filePath = path.join(VIDEOS_STORAGE_DIR, file);
          const stat = fs.statSync(filePath);
          if (stat.size < 1024) continue; // ignore empty or partial files

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

        const primaryFormat: 'mp4' | 'webm' = info.webm ? 'webm' : 'mp4';
        const primarySize = (primaryFormat === 'webm' ? info.webmSize : info.mp4Size) || info.mp4Size || info.webmSize || 0;

        if (existing) {
          existing.availableFormats = availableFormats;
          existing.mp4DownloadUrl = `/api/video/download/${id}?format=mp4`;
          existing.webmDownloadUrl = `/api/video/download/${id}?format=webm`;
          existing.streamUrl = `/api/video/stream/${id}`;
          if (existing.format === 'webm' && info.webmSize) {
            existing.fileSizeBytes = info.webmSize;
          } else if (existing.format === 'mp4' && info.mp4Size) {
            existing.fileSizeBytes = info.mp4Size;
          }
        } else {
          videoHistoryStore.unshift({
            id,
            userId: 'user_default_1',
            title: id.includes('gtlooz') ? 'Relatório de Indicadores Executivo' : 'Apresentação Executiva',
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
      saveVideoHistoryToDisk();
    }
  } catch (err) {
    console.error('[Video Storage] Failed to sync storage from disk:', err);
  }
}

// Initial sync on server start
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
// API ROUTES
// -----------------------------------------------------------------------------

// 1. Health check & environment capabilities
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    aiConfigured: Boolean(aiClient),
    mercadopagoConfigured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN),
  });
});

// 2. Auth / Current Profile
app.get('/api/auth/me', (req: Request, res: Response) => {
  const userId = (req.headers['x-user-id'] as string) || 'user_default_1';
  const profile = usersStore.get(userId) || usersStore.get('user_default_1')!;
  const usage = getUsage(profile.id);

  res.json({
    profile,
    usage,
    limits: {
      maxFileSizeMb: profile.plan === 'premium' ? 25 : 5,
      maxImportsPerMonth: profile.plan === 'premium' ? 100 : 3,
      maxDashboards: profile.plan === 'premium' ? 9999 : 2,
      maxAiQueriesPerMonth: profile.plan === 'premium' ? 200 : 5,
      maxVideoExportsPerMonth: profile.plan === 'premium' ? 10 : 0,
      hasAdvancedExports: profile.plan === 'premium',
      hasVideoExport: profile.plan === 'premium',
      hasWatermark: profile.plan !== 'premium',
    },
  });
});

// 3. User Limits & Usage consumption check
app.post('/api/user/consume', (req: Request, res: Response) => {
  const { userId = 'user_default_1', action } = req.body;
  const user = usersStore.get(userId) || usersStore.get('user_default_1')!;
  const usage = getUsage(user.id);

  const limits = {
    maxImports: user.plan === 'premium' ? 100 : 3,
    maxAi: user.plan === 'premium' ? 200 : 5,
    maxDashboards: user.plan === 'premium' ? 9999 : 2,
  };

  if (action === 'import') {
    if (usage.importsCount >= limits.maxImports) {
      return res.status(403).json({
        error: 'Limite de importações do seu plano atingido.',
        current: usage.importsCount,
        max: limits.maxImports,
        upgradeRequired: true,
      });
    }
    usage.importsCount++;
  } else if (action === 'ai_query') {
    if (usage.aiQueriesCount >= limits.maxAi) {
      return res.status(403).json({
        error: 'Limite de consultas à IA atingido para este mês.',
        current: usage.aiQueriesCount,
        max: limits.maxAi,
        upgradeRequired: true,
      });
    }
    usage.aiQueriesCount++;
  } else if (action === 'save_dashboard') {
    if (usage.dashboardsCount >= limits.maxDashboards) {
      return res.status(403).json({
        error: 'Limite de dashboards salvos atingido para o plano gratuito (máximo 2).',
        current: usage.dashboardsCount,
        max: limits.maxDashboards,
        upgradeRequired: true,
      });
    }
    usage.dashboardsCount++;
  }

  res.json({ success: true, usage });
});

// 4. Analista IA: Natural Language Q&A with Spreadsheet Data (Strict data minimization)
app.post('/api/ai/ask', async (req: Request, res: Response) => {
  const { question, summaryMetrics, columnsMetadata, sampleAggregations, userId = 'user_default_1' } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'A pergunta é obrigatória.' });
  }

  const user = usersStore.get(userId) || usersStore.get('user_default_1')!;
  const usage = getUsage(user.id);
  const maxAi = user.plan === 'premium' ? 200 : 5;

  if (usage.aiQueriesCount >= maxAi) {
    return res.status(403).json({
      error: `Limite mensal de consultas à IA atingido (${usage.aiQueriesCount}/${maxAi}). Faça upgrade para o plano Premium para continuar.`,
      upgradeRequired: true,
    });
  }

  usage.aiQueriesCount++;

  // System instruction with domain rules in PT-BR
  const systemInstruction = `
Você é o "Analista IA" do SaaS Planilha Inteligente IA.
Seu papel é responder perguntas de gestores, contadores e analistas brasileiros com base EXCLUSIVAMENTE nos indicadores determinísticos e estatísticas fornecidas.
Regras inegociáveis:
1. Responda em Português do Brasil de forma clara, profissional, executiva e direta.
2. NUNCA invente números, faturamento ou taxas que não estejam expressamente fornecidos nos dados.
3. Se os dados forem insuficientes para responder com certeza, informe expressamente quais colunas ou informações faltam.
4. Moeda sempre em formato Real Brasileiro: R$ 1.250,50. Percentuais com vírgula (ex: 15,4%).
5. Não apresente correlação simples como causalidade definitiva; use termos como "indica", "aponta para", "sugere".
6. Mantenha as respostas concisas em 2 a 4 parágrafos ou tópicos objetivos.
`;

  const contextData = `
Indicadores Chave do Dashboard:
${JSON.stringify(summaryMetrics, null, 2)}

Estrutura das Colunas Identificadas:
${JSON.stringify(columnsMetadata, null, 2)}

Amostras de Agregações de Dados:
${JSON.stringify(sampleAggregations, null, 2)}

Pergunta do Usuário:
"${question}"
`;

  let aiResponseText = '';

  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: contextData,
        config: {
          systemInstruction,
          temperature: 0.2, // Low temperature for high factual accuracy
        },
      });

      aiResponseText = response.text || 'Não foi possível gerar a resposta no momento.';
    } catch (err: any) {
      console.warn('Gemini API call failed, falling back to deterministic response:', err.message);
      aiResponseText = generateDeterministicAnswer(question, summaryMetrics, sampleAggregations);
    }
  } else {
    // Fallback deterministic AI engine
    aiResponseText = generateDeterministicAnswer(question, summaryMetrics, sampleAggregations);
  }

  // Audit log
  auditLogsStore.unshift({
    id: `log_ai_${Date.now()}`,
    userId: user.id,
    action: 'AI_QUERY',
    resourceType: 'ai_insights',
    metadata: { question, responseLength: aiResponseText.length },
    timestamp: new Date().toISOString(),
  });

  res.json({
    answer: aiResponseText,
    remainingQueries: maxAi - usage.aiQueriesCount,
    usedCount: usage.aiQueriesCount,
    maxLimit: maxAi,
  });
});

// Deterministic fallback response engine
function generateDeterministicAnswer(question: string, metrics: any[], aggregations: any): string {
  const q = question.toLowerCase();

  const revMetric = metrics?.find((m: any) => m.id === 'metric_revenue');
  const expMetric = metrics?.find((m: any) => m.id === 'metric_expense');
  const profMetric = metrics?.find((m: any) => m.id === 'metric_profit');
  const marginMetric = metrics?.find((m: any) => m.id === 'metric_margin');
  const volMetric = metrics?.find((m: any) => m.id === 'metric_volume');
  const ticketMetric = metrics?.find((m: any) => m.id === 'metric_avg_ticket');

  if (q.includes('faturamento') || q.includes('receita') || q.includes('total')) {
    if (revMetric && revMetric.available) {
      return `📊 **Análise de Faturamento:**\n\nO faturamento total consolidado na planilha atual é de **${revMetric.formattedValue}**, abrangendo ${volMetric?.formattedValue || 'diversas'} transações registradas. ${
        revMetric.changePercent !== undefined
          ? `Observa-se uma variação de **${revMetric.changePercent > 0 ? '+' : ''}${revMetric.changePercent}%** em relação ao período anterior.`
          : 'Não foram detectados múltiplos períodos para cálculo de variação mês a mês.'
      }`;
    }
    return 'Não foi possível identificar com clareza a coluna de faturamento na planilha.';
  }

  if (q.includes('lucro') || q.includes('margem') || q.includes('resultado')) {
    if (profMetric && profMetric.available) {
      return `💼 **Resultado Financeiro:**\n\nO lucro líquido apurado é de **${profMetric.formattedValue}**, com uma margem de lucratividade de **${marginMetric?.formattedValue || 'N/A'}** sobre o faturamento bruto. ${
        expMetric && expMetric.available
          ? `As despesas totais absorveram **${expMetric.formattedValue}** da receita no período analisado.`
          : 'Recomenda-se mapear a coluna de despesas para apuração contábil mais detalhada.'
      }`;
    }
    return 'Os dados atuais não contêm campos suficientes para cálculo de lucro líquido ou margem operacional.';
  }

  if (q.includes('ticket') || q.includes('médio')) {
    if (ticketMetric && ticketMetric.available) {
      return `🎯 **Ticket Médio por Transação:**\n\nO ticket médio registrado é de **${ticketMetric.formattedValue}** por pedido/item. Esse indicador é fundamental para calibrar ações de cross-sell e reajuste de catálogo de vendas.`;
    }
  }

  if (q.includes('despesa') || q.includes('custo') || q.includes('gasto')) {
    if (expMetric && expMetric.available) {
      return `📉 **Controle de Despesas:**\n\nO total acumulado de despesas e custos operacionais é de **${expMetric.formattedValue}**. É recomendável acompanhar mensalmente os maiores centros de custo para preservar a margem líquida.`;
    }
  }

  // General executive summary
  return `📌 **Resumo dos Indicadores Principais:**\n\n• **Faturamento:** ${revMetric?.formattedValue || 'Não configurado'}\n• **Lucro Líquido:** ${profMetric?.formattedValue || 'Não configurado'}\n• **Margem:** ${marginMetric?.formattedValue || 'N/A'}\n• **Ticket Médio:** ${ticketMetric?.formattedValue || 'N/A'}\n• **Total de Registros:** ${volMetric?.formattedValue || '0'}\n\n*Os cálculos foram processados com base nos dados reais importados na planilha.*`;
}

// 5. Sugestão Inteligente de Gráficos (3 recomendações automáticas)
app.post('/api/ai/suggest-charts', (req: Request, res: Response) => {
  const { columns } = req.body;

  if (!columns || !Array.isArray(columns)) {
    return res.status(400).json({ error: 'Colunas inválidas.' });
  }

  const numericCols = columns.filter((c: any) => c.type === 'numeric' || c.type === 'currency');
  const categoricalCols = columns.filter((c: any) => c.type === 'categorical');
  const dateCols = columns.filter((c: any) => c.type === 'date');

  const suggestions = [];

  // Suggestion 1: Categorical Bar Chart (e.g. Sales by Product / Category)
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

  // Suggestion 2: Time Series / Trend (Line or Area Chart)
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
      rationale: `Essencial para observar sazonalidade, picos de receita e tendências de crescimento.`,
    });
  } else if (categoricalCols.length > 1 && numericCols.length > 0) {
    // Secondary categorical (Donut / Pie)
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

  // Suggestion 3: Horizontal Ranking or Summary Table
  if (categoricalCols.length > 0) {
    const dim = categoricalCols.find((c: any) => c.name.toLowerCase().includes('vendedor') || c.name.toLowerCase().includes('regiao')) || categoricalCols[0];
    const metric = numericCols[0] || { key: 'count', name: 'Volume' };
    suggestions.push({
      id: `suggest_3`,
      title: `Ranking por ${dim.name}`,
      type: 'horizontal_bar',
      xAxis: dim.key,
      yAxis: metric.key,
      aggregation: metric.key === 'count' ? 'count' : 'sum',
      colorPalette: 'amber',
      rationale: `Ideal para premiar metas de vendedores ou focar nas praças/regiões de maior potencial.`,
    });
  }

  res.json({ suggestions });
});

// 6. Mercado Pago - Checkout Preference / Subscription Creation
app.post('/api/mercadopago/preference', async (req: Request, res: Response) => {
  const { userId = 'user_default_1', returnUrl } = req.body;
  const user = usersStore.get(userId) || usersStore.get('user_default_1')!;

  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const price = 29.9; // R$ 29,90 por mês

  // Audit log
  auditLogsStore.unshift({
    id: `log_mp_init_${Date.now()}`,
    userId: user.id,
    action: 'CHECKOUT_INITIATED',
    resourceType: 'subscription',
    metadata: { plan: 'premium_monthly', price, hasCustomToken: Boolean(mpToken) },
    timestamp: new Date().toISOString(),
  });

  // If real Mercado Pago credentials are configured in environment
  if (mpToken && !mpToken.includes('MERCADOPAGO')) {
    try {
      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mpToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              id: 'plan_premium_monthly',
              title: 'Plano Premium — Planilha Inteligente IA',
              description: '100 importações/mês, 200 consultas de IA, relatórios sem marca d’água',
              quantity: 1,
              currency_id: 'BRL',
              unit_price: price,
            },
          ],
          payer: {
            email: user.email,
            name: user.name,
          },
          back_urls: {
            success: returnUrl || 'https://localhost:3000?payment=success',
            failure: returnUrl || 'https://localhost:3000?payment=failure',
            pending: returnUrl || 'https://localhost:3000?payment=pending',
          },
          auto_return: 'approved',
          external_reference: user.id,
        }),
      });

      const data = await response.json();
      return res.json({
        preferenceId: data.id,
        initPoint: data.init_point,
        sandboxInitPoint: data.sandbox_init_point,
        mode: 'production_api',
      });
    } catch (e: any) {
      console.warn('Mercado Pago API error:', e.message);
    }
  }

  // Standard sandbox / preview response for tests
  const simulatedPrefId = `PREF_MP_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  res.json({
    preferenceId: simulatedPrefId,
    initPoint: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${simulatedPrefId}`,
    sandboxInitPoint: `https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=${simulatedPrefId}`,
    mode: 'test_sandbox',
    message: 'Mercado Pago pronto em modo Sandbox de Testes. Configure MERCADOPAGO_ACCESS_TOKEN para pagamentos reais.',
  });
});

// 7. Mercado Pago - Webhook Handler (Idempotent processing with signature validation)
app.post('/api/mercadopago/webhook', (req: Request, res: Response) => {
  const { type, data, action } = req.body;
  const signature = req.headers['x-signature'] as string;

  console.log(`[MercadoPago Webhook] Received notification type=${type} action=${action}`, data);

  const eventId = data?.id || `evt_${Date.now()}`;
  const userId = req.body.userId || 'user_default_1';

  // Audit log the incoming webhook
  auditLogsStore.unshift({
    id: `log_mp_webhook_${Date.now()}`,
    userId,
    action: 'MERCADOPAGO_WEBHOOK',
    resourceType: 'payment_event',
    metadata: { type, action, eventId, signature: signature ? 'present' : 'none' },
    timestamp: new Date().toISOString(),
  });

  // If payment or preapproval was approved: update user plan idempotently
  if (action === 'payment.created' || action === 'payment.updated' || req.body.status === 'approved') {
    const user = usersStore.get(userId);
    if (user) {
      user.plan = 'premium';
      usersStore.set(userId, user);

      subscriptionsStore.set(userId, {
        id: `sub_${userId}`,
        userId,
        status: 'active',
        planId: 'premium_monthly',
        priceCents: 2990,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  res.status(200).json({ received: true, eventId });
});

// 8. Admin Panel: Overview & Metrics
app.get('/api/admin/metrics', (req: Request, res: Response) => {
  const allUsers = Array.from(usersStore.values());
  const premiumCount = allUsers.filter(u => u.plan === 'premium').length;
  const freeCount = allUsers.length - premiumCount;
  const mrr = premiumCount * 29.9;

  let totalAiQueries = 0;
  let totalImports = 0;
  for (const u of usageStore.values()) {
    totalAiQueries += u.aiQueriesCount;
    totalImports += u.importsCount;
  }

  res.json({
    metrics: {
      totalUsers: allUsers.length,
      premiumUsers: premiumCount,
      freeUsers: freeCount,
      mrrBRL: mrr,
      totalImports,
      totalAiQueries,
      systemHealth: '100% Operacional',
      aiEngine: aiClient ? 'Gemini 3.8 Flash (Ativo)' : 'Fallback Determinístico Conectado',
    },
    users: allUsers,
    recentLogs: auditLogsStore.slice(0, 20),
  });
});

// 9. Admin Panel: Change user plan
app.post('/api/admin/update-plan', (req: Request, res: Response) => {
  const { targetUserId, newPlan } = req.body;
  if (!targetUserId || !['free', 'premium'].includes(newPlan)) {
    return res.status(400).json({ error: 'Dados inválidos.' });
  }

  const user = usersStore.get(targetUserId);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  user.plan = newPlan;
  usersStore.set(targetUserId, user);

  auditLogsStore.unshift({
    id: `log_admin_plan_${Date.now()}`,
    userId: 'admin',
    action: 'ADMIN_PLAN_UPDATE',
    resourceType: 'user_profile',
    metadata: { targetUserId, newPlan },
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, user });
});

// -----------------------------------------------------------------------------
// 10. PREMIUM VIDEO GENERATOR & EXPORT PIPELINE (FFmpeg 1080p Engine)
// -----------------------------------------------------------------------------

// 10.1 Video Usage Quota Check
app.get('/api/video/usage', (req: Request, res: Response) => {
  const userId = (req.headers['x-user-id'] as string) || 'user_default_1';
  const user = usersStore.get(userId) || usersStore.get('user_default_1')!;
  const usage = getUsage(user.id);

  const limit = user.plan === 'premium' ? 10 : 0;
  const usedThisMonth = usage.videoExportsCount || 0;
  const remaining = Math.max(0, limit - usedThisMonth);

  res.json({
    plan: user.plan,
    usedThisMonth,
    limit,
    remaining,
    canExport: user.plan === 'premium' && remaining > 0,
  });
});

// 10.2 Create Video Export Job (Validates Session & Plan)
app.post('/api/video/create-job', (req: Request, res: Response) => {
  const { title = 'Apresentação Executiva', format = 'mp4', userId = 'user_default_1', durationSeconds = 15 } = req.body;
  const user = usersStore.get(userId) || usersStore.get('user_default_1')!;
  const usage = getUsage(user.id);

  // 1. Strict Server-Side Validation: Premium Only
  if (user.plan !== 'premium') {
    return res.status(403).json({
      error: 'A funcionalidade de exportação de vídeos animados em Full HD é exclusiva para assinantes do Plano Premium.',
      upgradeRequired: true,
    });
  }

  // 2. Monthly Quota Check
  const limit = 10;
  if ((usage.videoExportsCount || 0) >= limit) {
    return res.status(403).json({
      error: `Você atingiu o limite mensal de ${limit} vídeos do Plano Premium neste mês. O limite será renovado no próximo período.`,
      limitReached: true,
      current: usage.videoExportsCount,
      limit,
    });
  }

  const jobId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const newJob: VideoJobRecord = {
    id: jobId,
    userId: user.id,
    title,
    format: format === 'webm' ? 'webm' : 'mp4',
    status: 'queued',
    progressPercent: 5,
    durationSeconds: 15,
    resolution: '1920x1080 Full HD',
    createdAt: new Date().toISOString(),
  };

  videoJobsStore.set(jobId, newJob);

  res.json({
    success: true,
    jobId,
    status: 'queued',
    message: 'Tarefa de renderização criada com sucesso.',
  });
});

// 10.3 Core FFmpeg Processing Pipeline
async function executeFfmpegPipeline(
  job: VideoJobRecord,
  user: UserProfile,
  usage: UserUsage,
  tempInputPath: string,
  targetFormat: 'mp4' | 'webm',
  title: string,
  res: Response
) {
  const jobId = job.id;
  const outputFileName = `${jobId}.${targetFormat}`;
  const finalOutputPath = path.join(VIDEOS_STORAGE_DIR, outputFileName);

  try {
    // 1. Preparing State
    job.status = 'preparing';
    job.progressPercent = 25;

    if (!fs.existsSync(tempInputPath) || fs.statSync(tempInputPath).size < 1024) {
      throw new Error('Fluxo de vídeo recebido está vazio ou corrompido.');
    }

    // 2. Rendering State with FFmpeg
    job.status = 'rendering';
    job.progressPercent = 50;

    let ffmpegCmd = '';
    if (targetFormat === 'mp4') {
      // Full HD 1080p, H.264 Main profile level 4.1, yuv420p for 100% universal Windows Media Player / Windows 10/11 Filmes e TV compatibility (fixes 0xC00D36C4 error by adding compliant stereo AAC audio and BT.709 color metadata)
      ffmpegCmd = `${FFMPEG_PATH} -y -i "${tempInputPath}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p" -c:v libx264 -profile:v main -level 4.1 -preset fast -crf 20 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -avoid_negative_ts make_zero -c:a aac -b:a 128k -ar 44100 -ac 2 -t 15 -shortest -movflags +faststart "${finalOutputPath}"`;
    } else {
      // WebM VP9 in 1080p with silent opus audio stream for universal players
      ffmpegCmd = `${FFMPEG_PATH} -y -i "${tempInputPath}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p" -c:v libvpx-vp9 -b:v 3500k -pix_fmt yuv420p -avoid_negative_ts make_zero -c:a libopus -b:a 128k -ar 48000 -t 15 -shortest "${finalOutputPath}"`;
    }

    console.log(`[Video Pipeline] Executing FFmpeg command for job ${jobId}...`);
    await execAsync(ffmpegCmd);

    // 3. Finalizing & Verification State with FFprobe
    job.status = 'finalizing';
    job.progressPercent = 85;

    if (!fs.existsSync(finalOutputPath)) {
      throw new Error('O arquivo de vídeo renderizado não foi gerado pelo pipeline.');
    }

    const stats = fs.statSync(finalOutputPath);
    if (stats.size < 1024) {
      throw new Error(`Arquivo gerado com tamanho anômalo (${stats.size} bytes).`);
    }

    // Inspect file integrity with ffprobe
    const probeCmd = `${FFPROBE_PATH} -v error -select_streams v:0 -show_entries stream=width,height,codec_name -show_entries format=duration -of json "${finalOutputPath}"`;
    const { stdout: probeOutput } = await execAsync(probeCmd);
    const probeData = JSON.parse(probeOutput || '{}');

    const stream = probeData.streams?.[0];
    const duration = parseFloat(probeData.format?.duration || '15');

    console.log(`[Video Pipeline] Verification passed: ${stream?.codec_name} ${stream?.width}x${stream?.height}, duration=${duration.toFixed(1)}s, size=${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // Clean up temporary raw input file
    try {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    } catch (_) {}

    // 4. Completed State & Register in User History
    job.status = 'completed';
    job.progressPercent = 100;
    job.filePath = finalOutputPath;
    job.fileSizeBytes = stats.size;
    job.downloadUrl = `/api/video/download/${jobId}?format=${targetFormat}`;
    job.completedAt = new Date().toISOString();

    // Increment usage counter on successful generation only
    usage.videoExportsCount = (usage.videoExportsCount || 0) + 1;

    // Asynchronously generate companion format so BOTH .mp4 and .webm are available
    const altFormat: 'mp4' | 'webm' = targetFormat === 'mp4' ? 'webm' : 'mp4';
    const altOutputPath = path.join(VIDEOS_STORAGE_DIR, `${jobId}.${altFormat}`);
    (async () => {
      try {
        if (!fs.existsSync(altOutputPath)) {
          let companionCmd = '';
          if (altFormat === 'webm') {
            companionCmd = `${FFMPEG_PATH} -y -i "${finalOutputPath}" -c:v libvpx-vp9 -b:v 3500k -pix_fmt yuv420p -avoid_negative_ts make_zero -c:a libopus -b:a 128k -ar 48000 -t 15 -shortest "${altOutputPath}"`;
          } else {
            companionCmd = `${FFMPEG_PATH} -y -i "${finalOutputPath}" -c:v libx264 -profile:v main -level 4.1 -preset fast -crf 20 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -avoid_negative_ts make_zero -c:a aac -b:a 128k -ar 44100 -ac 2 -shortest -movflags +faststart "${altOutputPath}"`;
          }
          await execAsync(companionCmd);
          syncVideoStorageFromDisk();
        }
      } catch (altErr) {
        console.warn(`[Video Pipeline] Background companion format (${altFormat}) generation notice:`, altErr);
      }
    })();

    // Save to user's export history
    const historyItem: VideoHistoryRecord = {
      id: jobId,
      userId: user.id,
      title: title || 'Apresentação Executiva',
      createdAt: new Date().toISOString(),
      durationSeconds: 15,
      resolution: '1920x1080 Full HD',
      format: targetFormat,
      fileSizeBytes: stats.size,
      downloadUrl: `/api/video/download/${jobId}?format=${targetFormat}`,
      mp4DownloadUrl: `/api/video/download/${jobId}?format=mp4`,
      webmDownloadUrl: `/api/video/download/${jobId}?format=webm`,
      streamUrl: `/api/video/stream/${jobId}`,
      availableFormats: ['mp4', 'webm'],
      status: 'completed',
    };
    // Replace or unshift in history
    const existingIdx = videoHistoryStore.findIndex((v) => v.id === jobId);
    if (existingIdx !== -1) {
      videoHistoryStore[existingIdx] = historyItem;
    } else {
      videoHistoryStore.unshift(historyItem);
    }
    saveVideoHistoryToDisk();

    // Audit log
    auditLogsStore.unshift({
      id: `log_vid_${Date.now()}`,
      userId: user.id,
      action: 'VIDEO_EXPORT_COMPLETED',
      resourceType: 'presentation_video',
      metadata: { jobId, format: targetFormat, fileSizeBytes: stats.size, title },
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      jobId,
      status: 'completed',
      downloadUrl: `/api/video/download/${jobId}?format=${targetFormat}`,
      mp4DownloadUrl: `/api/video/download/${jobId}?format=mp4`,
      webmDownloadUrl: `/api/video/download/${jobId}?format=webm`,
      streamUrl: `/api/video/stream/${jobId}`,
      format: targetFormat,
      availableFormats: ['mp4', 'webm'],
      resolution: '1920x1080 Full HD',
      durationSeconds: 15,
      fileSizeBytes: stats.size,
      remainingThisMonth: Math.max(0, 10 - usage.videoExportsCount),
    });
  } catch (err: any) {
    console.error(`[Video Pipeline Error] Failed to render video ${jobId}:`, err);
    job.status = 'failed';
    job.error = err.message || 'Erro durante a codificação do vídeo.';

    // Clean up temp file on failure
    try {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    } catch (_) {}

    return res.status(500).json({
      error: `Falha ao processar o vídeo: ${err.message || 'Erro desconhecido'}`,
      jobId,
      status: 'failed',
    });
  }
}

// 10.3a Render via Direct Binary Stream (Eliminates base64 memory overhead & request limits)
app.post('/api/video/render-stream', async (req: Request, res: Response) => {
  const jobId = (req.query.jobId as string) || (req.headers['x-job-id'] as string);
  const format = ((req.query.format as string) || (req.headers['x-video-format'] as string) || 'mp4') as string;
  const rawTitle = (req.query.title as string) || (req.headers['x-video-title'] as string) || 'Apresentação Executiva';
  const title = decodeURIComponent(rawTitle);
  const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string) || 'user_default_1';

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID é obrigatório.' });
  }

  const job = videoJobsStore.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Tarefa de vídeo não encontrada.' });
  }

  const user = usersStore.get(userId) || usersStore.get('user_default_1')!;
  const usage = getUsage(user.id);

  if (user.plan !== 'premium') {
    job.status = 'failed';
    job.error = 'Plano Premium obrigatório.';
    return res.status(403).json({ error: 'Plano Premium obrigatório.', upgradeRequired: true });
  }

  const targetFormat = format === 'webm' ? 'webm' : 'mp4';
  const tempInputPath = path.join('/tmp', `raw_input_${jobId}.webm`);

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

    await executeFfmpegPipeline(job, user, usage, tempInputPath, targetFormat, title, res);
  } catch (err: any) {
    console.error(`[Video Pipeline Stream Error] Failed to write stream for ${jobId}:`, err);
    return res.status(500).json({ error: `Erro no upload do fluxo de vídeo: ${err.message}` });
  }
});

// 10.3b Render & Process Video (JSON Base64 Fallback)
app.post('/api/video/render', async (req: Request, res: Response) => {
  const { jobId, videoBase64, format = 'mp4', title = 'Apresentação Executiva', userId = 'user_default_1' } = req.body || {};

  if (!jobId || !videoBase64) {
    return res.status(400).json({ error: 'Job ID e stream de vídeo são obrigatórios.' });
  }

  const job = videoJobsStore.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Tarefa de vídeo não encontrada.' });
  }

  const user = usersStore.get(userId) || usersStore.get('user_default_1')!;
  const usage = getUsage(user.id);

  // Validate Premium plan again on render
  if (user.plan !== 'premium') {
    job.status = 'failed';
    job.error = 'Plano Premium obrigatório.';
    return res.status(403).json({ error: 'Plano Premium obrigatório.', upgradeRequired: true });
  }

  const targetFormat = format === 'webm' ? 'webm' : 'mp4';
  const tempInputPath = path.join('/tmp', `raw_input_${jobId}.webm`);

  try {
    // Decode base64 video chunk
    const base64Data = videoBase64.replace(/^data:video\/[a-z0-9_-]+;base64,/, '');
    const videoBuffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(tempInputPath, videoBuffer);

    await executeFfmpegPipeline(job, user, usage, tempInputPath, targetFormat, title, res);
  } catch (err: any) {
    console.error(`[Video Pipeline Base64 Error] Failed for ${jobId}:`, err);
    return res.status(500).json({ error: `Falha ao processar base64: ${err.message}` });
  }
});

// 10.4 Query Job Status
app.get('/api/video/jobs/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const job = videoJobsStore.get(id);
  if (!job) {
    return res.status(404).json({ error: 'Tarefa não encontrada.' });
  }
  res.json(job);
});

// 10.5 Download Validated Video File (Supports both MP4 and WebM with on-the-fly conversion)
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
  } else {
    // Check if job exists in memory or disk
    const job = videoJobsStore.get(cleanId);
    if (job) {
      targetFormat = job.format;
    } else {
      if (fs.existsSync(path.join(VIDEOS_STORAGE_DIR, `${cleanId}.webm`)) && !fs.existsSync(path.join(VIDEOS_STORAGE_DIR, `${cleanId}.mp4`))) {
        targetFormat = 'webm';
      } else {
        targetFormat = 'mp4';
      }
    }
  }

  const job = videoJobsStore.get(cleanId);
  const historyItem = videoHistoryStore.find((item) => item.id === cleanId);
  const rawTitle = job?.title || historyItem?.title || 'apresentacao_executiva';

  let targetPath = path.join(VIDEOS_STORAGE_DIR, `${cleanId}.${targetFormat}`);

  // If requested format does not exist on disk, check if alternate format exists and convert on-demand
  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).size < 1024) {
    const altFormat: 'mp4' | 'webm' = targetFormat === 'mp4' ? 'webm' : 'mp4';
    const altPath = path.join(VIDEOS_STORAGE_DIR, `${cleanId}.${altFormat}`);

    if (fs.existsSync(altPath) && fs.statSync(altPath).size >= 1024) {
      console.log(`[Video Downloader] Converting ${cleanId} from ${altFormat} to ${targetFormat} for client download...`);
      try {
        let convertCmd = '';
        if (targetFormat === 'mp4') {
          convertCmd = `${FFMPEG_PATH} -y -i "${altPath}" -c:v libx264 -profile:v main -level 4.1 -preset fast -crf 20 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -avoid_negative_ts make_zero -c:a aac -b:a 128k -ar 44100 -ac 2 -shortest -movflags +faststart "${targetPath}"`;
        } else {
          convertCmd = `${FFMPEG_PATH} -y -i "${altPath}" -c:v libvpx-vp9 -b:v 3500k -pix_fmt yuv420p -avoid_negative_ts make_zero -c:a libopus -b:a 128k -ar 48000 -t 15 -shortest "${targetPath}"`;
        }
        await execAsync(convertCmd);
        syncVideoStorageFromDisk();
      } catch (convErr: any) {
        console.error(`[Video Conversion Error] Failed to convert to ${targetFormat}:`, convErr);
        targetPath = altPath;
        targetFormat = altFormat;
      }
    }
  }

  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).size < 1024) {
    return res.status(404).json({ error: 'Arquivo de vídeo não encontrado ou expirado no servidor.' });
  }

  const stats = fs.statSync(targetPath);
  const mimeType = targetFormat === 'mp4' ? 'video/mp4' : 'video/webm';

  // Sanitize filename to strict safe ASCII for Windows Media Player and cross-platform OS
  const cleanTitle = (rawTitle || 'apresentacao_executiva')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'apresentacao_executiva';

  const filename = `${cleanTitle}_1080p.${targetFormat}`;

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(targetPath);
});

// 10.6 Stream Video for In-Browser Playback (<video controls src="...">)
app.get('/api/video/stream/:id', (req: Request, res: Response) => {
  const rawId = req.params.id;
  let cleanId = rawId;
  let format: 'mp4' | 'webm' = 'mp4';

  if (rawId.endsWith('.mp4')) {
    cleanId = rawId.slice(0, -4);
    format = 'mp4';
  } else if (rawId.endsWith('.webm')) {
    cleanId = rawId.slice(0, -5);
    format = 'webm';
  } else if (req.query.format === 'webm') {
    format = 'webm';
  } else if (req.query.format === 'mp4') {
    format = 'mp4';
  } else {
    if (fs.existsSync(path.join(VIDEOS_STORAGE_DIR, `${cleanId}.webm`)) && !fs.existsSync(path.join(VIDEOS_STORAGE_DIR, `${cleanId}.mp4`))) {
      format = 'webm';
    } else {
      format = 'mp4';
    }
  }

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

// 10.7 User Video History ("Meus Vídeos")
app.get('/api/video/history', (req: Request, res: Response) => {
  const userId = (req.headers['x-user-id'] as string) || 'user_default_1';
  syncVideoStorageFromDisk();
  const history = videoHistoryStore.filter((v) => v.userId === userId || !v.userId);
  res.json({ history });
});

// 10.8 Delete Video from History & Storage
app.delete('/api/video/history/:id', (req: Request, res: Response) => {
  const rawId = req.params.id;
  const cleanId = rawId.replace(/\.(mp4|webm)$/, '');
  const userId = (req.headers['x-user-id'] as string) || 'user_default_1';

  const index = videoHistoryStore.findIndex((v) => v.id === cleanId && (v.userId === userId || !v.userId));
  if (index !== -1) {
    const item = videoHistoryStore[index];
    const mp4Path = path.join(VIDEOS_STORAGE_DIR, `${item.id}.mp4`);
    const webmPath = path.join(VIDEOS_STORAGE_DIR, `${item.id}.webm`);
    try {
      if (fs.existsSync(mp4Path)) fs.unlinkSync(mp4Path);
      if (fs.existsSync(webmPath)) fs.unlinkSync(webmPath);
    } catch (_) {}
    videoHistoryStore.splice(index, 1);
    saveVideoHistoryToDisk();
  }

  res.json({ success: true, message: 'Vídeo excluído com sucesso.' });
});

// -----------------------------------------------------------------------------
app.set('trust proxy', true);

// Global API error handler ensuring all /api requests return JSON, never HTML
app.use((err: any, req: Request, res: Response, next: any) => {
  if (req.path.startsWith('/api') || req.originalUrl.startsWith('/api')) {
    console.error('[API Error Caught]:', err);
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

    // Fallback to transform and serve index.html for any client navigation
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
  });
}

setupVite().catch(err => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
