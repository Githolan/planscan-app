const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

// (usa el módulo existente; si no lo necesitas, puedes comentarlo)
const { analizarGraficoFinancieroFromBuffer } = require('./analisis_tecnico_financiero');

const app = express();
const HTTP_PORT = 3000;
const HTTPS_PORT = 443;

// Estáticos (sirve archivos del cwd del contenedor: /opt/app)
app.use(express.static('.'));

// CORS + JSON
app.use(cors());
app.use(express.json());

// Anti-caché básico para HTML
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.set('Cache-Control', 'no-store');
  }
  next();
});

// Multer en memoria (25 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// API key obligatoria
if (!process.env.GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY is not configured in .env file');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Ayudas: preflight CORS y alias /api/analyze
app.options('/analyze', cors());
app.get('/analyze', (_req, res) =>
  res.status(405).json({ error: 'Usa POST multipart con el campo "image" o "tradingImage"' })
);
app.post('/api/analyze', (req, res, next) => {
  req.url = '/analyze';
  next();
});

// --- /analyze: extracción del plan + resumen técnico en memoria ---
app.post(
  '/analyze',
  upload.fields([
    { name: 'tradingImage', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      // Acepta ambos nombres de campo
      const _f =
        req.file ||
        (req.files &&
          ((req.files.tradingImage && req.files.tradingImage[0]) ||
            (req.files.image && req.files.image[0])));

      if (!_f) {
        return res.status(400).json({ error: 'No se ha recibido ningún archivo de imagen' });
      }

      const prompt = `Actúa como un sistema experto de reconocimiento de planes de trading. Analiza la imagen proporcionada y extrae los siguientes datos del plan de trading:

1. Dirección (direction): "Long" o "Short"
2. Precio de entrada (entry_price): valor numérico
3. Stop Loss (stop_loss): valor numérico
4. Take Profits (take_profits): array de valores numéricos

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{"direction": "...", "entry_price": ..., "stop_loss": ..., "take_profits": [...]}

No incluyas explicaciones adicionales, solo el JSON.`;

      const imageBuffer = _f.buffer;
      const base64Image = imageBuffer.toString('base64');

      // Normaliza HEIC/HEIF a JPEG (compatibilidad)
      let mime = _f.mimetype || 'application/octet-stream';
      if (/heic|heif/i.test(mime)) {
        mime = 'image/jpeg';
        console.log('[UPLOAD] HEIC/HEIF detectado → usando image/jpeg');
      }

      // Modelo (puedes parametrizar con env: GEMINI_MODEL)
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
      const model = genAI.getGenerativeModel({ model: modelName });

      const imagePart = { inlineData: { data: base64Image, mimeType: mime } };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;

      // Modelo REAL usado por la API
      const modelVersion =
        response.modelVersion ||
        (response.candidates?.[0]?.content?.metadata?.model);
      console.log('[AI] modelVersion =', modelVersion);

      // Texto → JSON
      let text = response.text();
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        console.error('Error parsing JSON:', e);
        return res.status(500).json({
          error: 'Error al procesar la respuesta de la IA',
          details: 'La respuesta no pudo ser convertida a JSON válido',
        });
      }

      // Quita campo inventado por el LLM si existiera
      if (parsed.GenerativeModel) delete parsed.GenerativeModel;

      // Adjunta el modelo real
      parsed._model = modelVersion || 'unknown';

      // ===== Análisis técnico (solo resumen para la UI; sin persistencia) =====
      try {
        const uploadedName = _f.originalname || 'image';
        const tech = await analizarGraficoFinancieroFromBuffer(imageBuffer, uploadedName);
        parsed.technical_analysis = {
          summary: (tech && tech.analysis) || '',
        };
      } catch (e) {
        console.warn('[TECH] omitido:', e.message);
        parsed.technical_analysis = { summary: '' };
      }

      return res.json(parsed);
    } catch (error) {
      try {
        if (error && error.response) {
          const s = error.response.status || 0;
          const body =
            typeof error.response.text === 'function'
              ? await error.response.text()
              : error.response.data || error.message;
          console.error('[AI] HTTP error status=', s);
          console.error('[AI] HTTP error body  =', String(body).slice(0, 1000));
        } else {
          console.error('[AI] Error (sin response):', error?.stack || error?.message || error);
        }
      } catch {}
      return res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }
  }
);

// --- /analyze-chart: deshabilitado para evitar escrituras en disco ---
app.post('/analyze-chart', (_req, res) => {
  return res.status(501).json({
    success: false,
    error: 'Endpoint deshabilitado temporalmente',
  });
});

// HTTP
app.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`Servidor HTTP en http://0.0.0.0:${HTTP_PORT}`);
  console.log(`Disponible en http://planscan.holancloud.com:${HTTP_PORT}`);
});

// HTTPS opcional (si hay certificados en ./ssl)
try {
  const httpsOptions = {
    key: fs.readFileSync('./ssl/key.pem'),
    cert: fs.readFileSync('./ssl/cert.pem'),
  };
  https.createServer(httpsOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`Servidor HTTPS en https://0.0.0.0:${HTTPS_PORT}`);
    console.log(`Disponible en https://planscan.holancloud.com:${HTTPS_PORT}`);
  });
} catch (e) {
  console.log('HTTPS no iniciado (sin certificados en ./ssl):', e.message);
}
