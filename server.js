// server.js — limpio, listo para pegar

// ─────────────────────────────────────────────────────────────────────────────
// Imports & setup
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const https = require('https');
const path = require('path');
require('dotenv').config();

// Carga obligatoria del módulo unificado (en memoria)
let performUnifiedAnalysisFromBuffer = null;
try {
  ({ performUnifiedAnalysisFromBuffer } = require('./analisis_unificado'));
  console.log('[init] Módulo análisis_unificado cargado correctamente.');
} catch (e) {
  console.error('[init] ERROR CRÍTICO: Módulo análisis_unificado no disponible:', e.message);
  console.error('[init] El análisis unificado es obligatorio. El servidor no puede continuar sin este módulo.');
  process.exit(1);
}

// Gemini opcional
let GoogleGenerativeAI = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ({ GoogleGenerativeAI } = require('@google/generative-ai'));
  } catch (e) {
    console.warn('[init] Paquete @google/generative-ai no instalado:', e.message);
  }
}

// Yahoo Finance API
const YahooFinanceSimple = require('./yahooFinanceSimple');
const yahooFinance = new YahooFinanceSimple();

// ─────────────────────────────────────────────────────────────────────────────
const app = express();
const PORT = Number(process.env.PORT || 3000);
const STATIC_DIR = process.env.STATIC_DIR || '.';
const SSL_CERT_FILE = process.env.SSL_CERT_FILE || '';
const SSL_KEY_FILE = process.env.SSL_KEY_FILE || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';

// Estáticos + middlewares
app.use(express.static(STATIC_DIR));
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

// ─────────────────────────────────────────────────────────────────────────────
// Health & versión
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.get('/version', (_req, res) => res.json({ name: 'planscan', version: '3.2.0-enhanced' }));

// Root route - serve index.html
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// CORS preflight y alias
app.options('/analyze', cors());
app.get('/analyze', (_req, res) =>
  res.status(405).json({ error: 'Usa POST multipart con el campo "image" o "tradingImage"' })
);
app.post('/api/analyze', (req, res, next) => {
  // Alias /api/analyze → /analyze
  req.url = '/analyze';
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Yahoo Finance API endpoints
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/market-data/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    console.log(`[MarketData] Requesting data for ${symbol}`);

    const marketData = await yahooFinance.getMarketData(symbol);
    res.json({
      success: true,
      symbol: symbol,
      data: marketData,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error(`[MarketData] Error fetching data for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market data',
      details: error.message
    });
  }
});

app.get('/api/symbol-validate/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const isValid = await yahooFinance.isSymbolAvailable(symbol);

    res.json({
      success: true,
      symbol: symbol,
      valid: isValid,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error(`[SymbolValidate] Error validating ${req.params.symbol}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to validate symbol',
      details: error.message
    });
  }
});

app.post('/api/clear-cache', (_req, res) => {
  try {
    yahooFinance.clearCache();
    res.json({
      success: true,
      message: 'Yahoo Finance cache cleared successfully',
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      details: error.message
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────
function normalizeModelJsonText(txt) {
  // Quita cercas ``` y espacios
  return String(txt || '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/m, '')
    .trim();
}

function safeJsonParse(s) {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /analyze — análisis unificado completo (plan + técnico + inferencia + riesgo)
// ─────────────────────────────────────────────────────────────────────────────
app.post(
  '/analyze',
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'tradingImage', maxCount: 1 }]),
  async (req, res) => {
    try {
      // Acepta ambos nombres de campo
      const file =
        (req.files?.image && req.files.image[0]) ||
        (req.files?.tradingImage && req.files.tradingImage[0]);

      if (!file) {
        return res.status(400).json({ error: 'Falta el archivo (campo "image" o "tradingImage")' });
      }

      const received = {
        fieldName: file.fieldname,
        mimeType: file.mimetype,
        size: file.size,
        originalName: file.originalname,
        selectedSymbol: req.body.selectedSymbol || null,
      };

      // Validar que se proporcionó un símbolo (obligatorio para el análisis unificado)
      if (!req.body.selectedSymbol) {
        return res.status(400).json({
          error: 'El símbolo seleccionado es obligatorio para el análisis unificado',
          details: 'Por favor, seleccione un símbolo antes de cargar la imagen'
        });
      }

      // ── ANÁLISIS UNIFICADO COMPLETO (obligatorio)
      if (!performUnifiedAnalysisFromBuffer || !file.buffer) {
        return res.status(500).json({
          error: 'Error crítico: El análisis unificado es obligatorio pero no está disponible',
          details: !performUnifiedAnalysisFromBuffer ? 'Módulo de análisis unificado no cargado' : 'No se recibió el buffer de la imagen'
        });
      }

      try {
        console.log(`[unified] Iniciando análisis unificado para ${req.body.selectedSymbol}`);

        // ── OBTENER DATOS DE MERCADO EN TIEMPO REAL DESDE YAHOO FINANCE
        let marketData = null;
        let volatilityData = null;

        try {
            console.log(`[YahooFinance] Fetching real-time data for ${req.body.selectedSymbol}`);
            marketData = await yahooFinance.getMarketData(req.body.selectedSymbol);

            // Calcular datos de volatilidad básicos
            volatilityData = {
                currentPrice: marketData.price,
                bid: marketData.bid,
                ask: marketData.ask,
                spread: marketData.spread,
                digits: marketData.digits,
                tickSize: marketData.tickSize,
                change: marketData.change,
                changePercent: marketData.changePercent,
                timestamp: marketData.timestamp
            };

            console.log(`[YahooFinance] Market data obtained for ${req.body.selectedSymbol}:`, {
                price: marketData.price,
                spread: marketData.spread,
                change: marketData.changePercent
            });

        } catch (yahooError) {
            console.warn(`[YahooFinance] Could not fetch data for ${req.body.selectedSymbol}:`, yahooError.message);

            // Intentar usar el precio proporcionado desde el frontend como fallback
            const currentPrice = req.body.currentPrice ? parseFloat(req.body.currentPrice) : null;
            if (currentPrice) {
                console.log(`[Fallback] Using frontend price for ${req.body.selectedSymbol}: ${currentPrice}`);
                marketData = {
                    symbol: req.body.selectedSymbol,
                    price: currentPrice,
                    bid: currentPrice * 0.999, // Spread simulado
                    ask: currentPrice * 1.001,
                    digits: req.body.selectedSymbol.includes('JPY') ? 3 : 5,
                    spread: currentPrice * 0.002,
                    tickSize: Math.pow(10, req.body.selectedSymbol.includes('JPY') ? -3 : -5)
                };

                volatilityData = {
                    currentPrice: currentPrice,
                    ...marketData,
                    change: 0,
                    changePercent: 0,
                    timestamp: Date.now()
                };
            } else {
                console.error(`[Enhanced Analysis] No market data available for ${req.body.selectedSymbol}`);
            }
        }

        // Ejecutar análisis unificado completo
        const unifiedResult = await performUnifiedAnalysisFromBuffer(
          file.buffer,
          req.body.selectedSymbol,
          file.originalname || 'image',
          marketData?.price || null,
          volatilityData
        );

        if (unifiedResult && unifiedResult.success) {
          const result = unifiedResult.result;
          const tradingPlan = result.trading_plan || {};
          const technicalAnalysis = result.technical_analysis || {};
          const validation = result.validation || {};
          const riskAnalysis = validation.risk_analysis || {};

          console.log(`[unified] Análisis completado exitosamente para ${result.symbol}`);

          // ── Construir respuesta unificada
          const response = {
            ok: true,
            received,
            symbol: result.symbol || req.body.selectedSymbol,
            direction: tradingPlan.direction || null,
            entry_price: tradingPlan.entry_price ?? null,
            stop_loss: tradingPlan.stop_loss ?? null,
            take_profits: Array.isArray(tradingPlan.take_profits) ? tradingPlan.take_profits : [],
            technical_analysis: {
              summary: technicalAnalysis.summary || ''
            },
            // Nuevos campos unificados
            risk_analysis: riskAnalysis,
            validation: validation,
            confidence: unifiedResult.confidence,
            metadata: result.metadata || {},
            _model: 'unified-analysis',
            _version: '3.1.0'
          };

          // Añadir advertencias si existen
          if (result.user_warning) {
            response.user_warning = result.user_warning;
          }
          if (result.risk_warnings && result.risk_warnings.length > 0) {
            response.risk_warnings = result.risk_warnings;
          }

          return res.json(response);

        } else {
          return res.status(500).json({
            error: 'Error en análisis unificado: El módulo no pudo procesar la imagen',
            details: unifiedResult?.error || 'Error desconocido en el procesamiento unificado'
          });
        }

      } catch (e) {
        console.error('[unified] ERROR CRÍTICO: análisis unificado falló:', e.message);
        return res.status(500).json({
          error: 'Error crítico en análisis unificado',
          details: e.message,
          note: 'El análisis unificado es obligatorio y no puede continuar'
        });
      }

    } catch (err) {
      console.error('[ERROR] /analyze:', err);
      return res.status(500).json({ error: 'Error procesando análisis unificado', details: err.message });
    }
  }
);

// (opcional) Deshabilitado para evitar archivos temporales
app.post('/analyze-chart', (_req, res) => {
  res.status(501).json({ success: false, error: 'Endpoint deshabilitado temporalmente' });
});

// ─────────────────────────────────────────────────────────────────────────────
// HTTP server
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[planscan] HTTP escuchando en :${PORT} (STATIC_DIR=${path.resolve(STATIC_DIR)})`);
  console.log(`[planscan] Disponible en:`);
  console.log(`  - http://localhost:${PORT}/index.html`);
  console.log(`  - http://localhost:${PORT}/`);
});

// ─────────────────────────────────────────────────────────────────────────────
// HTTPS opcional (si defines SSL_CERT_FILE y SSL_KEY_FILE)
// ─────────────────────────────────────────────────────────────────────────────
if (SSL_CERT_FILE && SSL_KEY_FILE) {
  try {
    const key = fs.readFileSync(SSL_KEY_FILE);
    const cert = fs.readFileSync(SSL_CERT_FILE);
    https.createServer({ key, cert }, app).listen(443, '0.0.0.0', () => {
      console.log('[planscan] HTTPS escuchando en :443');
      console.log(`[planscan] HTTPS disponible en:`);
      console.log(`  - https://localhost:443/index.html`);
      console.log(`  - https://localhost:443/`);
      console.log(`  - https://testlocal.holancloud.com:443/index.html`);
      console.log(`  - https://testlocal.holancloud.com:443/`);
      console.log(`[planscan] SSL cargado desde: ${SSL_CERT_FILE} y ${SSL_KEY_FILE}`);
    });
  } catch (e) {
    console.warn('[planscan] HTTPS no iniciado:', e.message);
    console.log('[planscan] Verifica que los archivos SSL existan y sean válidos');
  }
} else {
  console.log('[planscan] HTTPS no configurado - Solo HTTP disponible');
  console.log('[planscan] Para habilitar HTTPS, define SSL_CERT_FILE y SSL_KEY_FILE en .env');
}
