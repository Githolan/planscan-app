require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Configurar Gemini AI con la API key del archivo .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Función para leer el prompt de análisis técnico
function getAnalysisPrompt() {
    try {
        const promptPath = path.join(__dirname, 'prompt_analisis_tecnico.md');
        return fs.readFileSync(promptPath, 'utf8');
    } catch (error) {
        console.error('❌ Error al leer el archivo de prompt:', error.message);
        return null;
    }
}

async function analizarGraficoFinanciero(imagePath) {
    try {
        console.log('🔍 Iniciando análisis del gráfico financiero...');

        // Verificar que el archivo existe
        if (!fs.existsSync(imagePath)) {
            throw new Error(`❌ Archivo ${path.basename(imagePath)} no encontrado`);
        }

        console.log('✅ Archivo encontrado:', imagePath);

        // Leer la imagen
        const imageBuffer = fs.readFileSync(imagePath);
        const imageBase64 = imageBuffer.toString('base64');

        console.log('📊 Tamaño de imagen:', Math.round(imageBuffer.length / 1024), 'KB');

        // Obtener el prompt para análisis técnico financiero
        const prompt = getAnalysisPrompt();
        if (!prompt) {
            throw new Error('❌ No se pudo cargar el prompt de análisis técnico');
        }

        // Crear el contenido para la API
        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: 'image/jpeg'
            }
        };

        // Usar el modelo gemini-2.0-flash para análisis técnico
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        console.log('🚀 Enviando imagen a Gemini AI...');

        // Generar análisis
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const analysis = response.text();

        console.log('\n' + '='.repeat(80));
        console.log('📋 ANÁLISIS TÉCNICO FINANCIERO');
        console.log('='.repeat(80));
        console.log(analysis);
        console.log('='.repeat(80));

        // Guardar el análisis en un archivo
        const outputDir = path.join(__dirname, 'analisis_tecnico');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputFilename = `analisis_${path.basename(imagePath, path.extname(imagePath))}_${Date.now()}.md`;
        const analysisPath = path.join(outputDir, outputFilename);
        const fullReport = `# ANÁLISIS TÉCNICO FINANCIERO - ${path.basename(imagePath)}\n` +
                          `Fecha: ${new Date().toLocaleString()}\n` +
                          `Modelo: Gemini 2.0 Flash\n` +
                          `${'---'.repeat(30)}\n\n` +
                          analysis;

        fs.writeFileSync(analysisPath, fullReport, 'utf8');
        console.log('\n💾 Análisis guardado en:', analysisPath);

        return {
            success: true,
            analysis: analysis,
            imagePath: imagePath,
            analysisPath: analysisPath,
            imageSize: Math.round(imageBuffer.length / 1024) + ' KB'
        };

    } catch (error) {
        console.error('❌ Error en el análisis:', error.message);

        if (error.message.includes('GEMINI_API_KEY')) {
            console.log('\n🔑 Verifica que GEMINI_API_KEY esté configurada en el archivo .env');
        }

        if (error.message.includes('quota')) {
            console.log('\n⚠️ Posible límite de cuota alcanzado. Espera unos minutos.');
        }

        return {
            success: false,
            error: error.message
        };
    }
}

// Función para analizar gráfico desde buffer (para uso con multer)
async function analizarGraficoFinancieroFromBuffer(imageBuffer, originalFilename) {
    try {
        console.log('🔍 Iniciando análisis del gráfico financiero desde buffer...');

        const imageBase64 = imageBuffer.toString('base64');
        console.log('📊 Tamaño de imagen:', Math.round(imageBuffer.length / 1024), 'KB');

        // Obtener el prompt para análisis técnico financiero
        const prompt = getAnalysisPrompt();
        if (!prompt) {
            throw new Error('❌ No se pudo cargar el prompt de análisis técnico');
        }

        // Crear el contenido para la API
        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: 'image/jpeg'
            }
        };

        // Usar el modelo gemini-2.0-flash para análisis técnico
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        console.log('🚀 Enviando imagen a Gemini AI...');

        // Generar análisis
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const analysis = response.text();

        console.log('\n' + '='.repeat(80));
        console.log('📋 ANÁLISIS TÉCNICO FINANCIERO');
        console.log('='.repeat(80));
        console.log(analysis);
        console.log('='.repeat(80));

        // Guardar el análisis en un archivo
        const outputDir = path.join(__dirname, 'analisis_tecnico');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputFilename = `analisis_${path.basename(originalFilename, path.extname(originalFilename))}_${Date.now()}.md`;
        const analysisPath = path.join(outputDir, outputFilename);
        const fullReport = `# ANÁLISIS TÉCNICO FINANCIERO - ${originalFilename}\n` +
                          `Fecha: ${new Date().toLocaleString()}\n` +
                          `Modelo: Gemini 2.0 Flash\n` +
                          `${'---'.repeat(30)}\n\n` +
                          analysis;

        fs.writeFileSync(analysisPath, fullReport, 'utf8');
        console.log('\n💾 Análisis guardado en:', analysisPath);

        return {
            success: true,
            analysis: analysis,
            imagePath: originalFilename,
            analysisPath: analysisPath,
            imageSize: Math.round(imageBuffer.length / 1024) + ' KB'
        };

    } catch (error) {
        console.error('❌ Error en el análisis:', error.message);

        if (error.message.includes('GEMINI_API_KEY')) {
            console.log('\n🔑 Verifica que GEMINI_API_KEY esté configurada en el archivo .env');
        }

        if (error.message.includes('quota')) {
            console.log('\n⚠️ Posible límite de cuota alcanzado. Espera unos minutos.');
        }

        return {
            success: false,
            error: error.message
        };
    }
}

// Exportar las funciones para uso en otros scripts
module.exports = {
    analizarGraficoFinanciero,
    analizarGraficoFinancieroFromBuffer,
    getAnalysisPrompt
};