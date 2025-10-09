document.addEventListener('DOMContentLoaded', function() {
    // Image Analysis Elements
    const fileInput = document.getElementById('tradingImage');
    const uploadArea = document.getElementById('uploadArea');
    const pasteButton = document.getElementById('pasteButton');
    const imagePreview = document.getElementById('imagePreview');
    const analyzeButton = document.getElementById('analyzeButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const aiAnalysisBox = document.getElementById('aiAnalysisBox');
    const aiAnalysisContent = document.getElementById('aiAnalysisContent');
    const applyPlanButton = document.getElementById('applyPlanButton');

    // Trading Form Elements
    const form = document.getElementById('tradingPlanForm');
    const validateBtn = document.getElementById('validateBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const clearBtn = document.getElementById('clearBtn');
    const instructionsBtn = document.getElementById('instructionsBtn');
    const mt4Output = document.getElementById('mt4Output');
    const validationStatus = document.getElementById('validationStatus');

    // Modal Elements
    const instructionsModal = document.getElementById('instructionsModal');
    const closeInstructionsModal = document.getElementById('closeInstructionsModal');

    // Symbol search elements
    const tradeSymbol = document.getElementById('tradeSymbol');
    const symbolDropdown = document.getElementById('symbolDropdown');
    const symbolCount = document.getElementById('symbolCount');

    // Form input elements
    const formInputs = {
        tradeSymbol: document.getElementById('tradeSymbol'),
        plan: document.getElementById('plan'),
        entryType: document.getElementById('entryType'),
        limitBehavior: document.getElementById('limitBehavior'),
        entryPoint: document.getElementById('entryPoint'),
        stopLoss: document.getElementById('stopLoss'),
        totalVolume: document.getElementById('totalVolume'),
        riskPercent: document.getElementById('riskPercent'),
        tp1: document.getElementById('tp1'),
        tp2: document.getElementById('tp2'),
        tp3: document.getElementById('tp3'),
        tp4: document.getElementById('tp4'),
        tp5: document.getElementById('tp5'),
        slippage: document.getElementById('slippage'),
        orderComment: document.getElementById('orderComment')
    };

    // Trading symbols data
    let allSymbols = [];
    let filteredSymbols = [];
    let popularSymbols = [];
    let symbolsConfig = null;
    let extractedData = null;

    // Initialize
    loadSymbolsFromJSON();
    initializeEventListeners();

    // ==================== SYMBOL LOADING ====================

    async function loadSymbolsFromJSON() {
        try {
            symbolCount.textContent = 'Loading symbols...';
            const response = await fetch('symbols.json');
            const symbolsData = await response.json();
            
            // Extract symbols from new structure with enhanced information
            allSymbols = [];
            Object.keys(symbolsData.categories).forEach(categoryKey => {
                const category = symbolsData.categories[categoryKey];
                category.symbols.forEach(symbolInfo => {
                    allSymbols.push({
                        symbol: symbolInfo.symbol,
                        name: symbolInfo.name || symbolInfo.symbol,
                        category: categoryKey,
                        categoryIcon: category.icon,
                        categoryName: category.name,
                        fullInfo: symbolInfo
                    });
                });
            });
            
            // Sort symbols alphabetically
            allSymbols.sort((a, b) => a.symbol.localeCompare(b.symbol));
            filteredSymbols = [...allSymbols];
            
            // Store config and popular symbols
            symbolsConfig = symbolsData;
            if (symbolsData.features && symbolsData.features.search && symbolsData.features.search.popularSymbols) {
                popularSymbols = symbolsData.features.search.popularSymbols.map(symbol => 
                    allSymbols.find(s => s.symbol === symbol)
                ).filter(Boolean);
            }
            
            updateSymbolCount();
        } catch (error) {
            console.error('Error loading symbols:', error);
            symbolCount.textContent = 'Error loading symbols';
            // Fallback to basic symbols
            allSymbols = [
                { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'forex' },
                { symbol: 'GBPUSD', name: 'British Pound / US Dollar', category: 'forex' },
                { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', category: 'forex' },
                { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', category: 'forex' },
                { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', category: 'forex' },
                { symbol: 'XAUUSD', name: 'Gold / US Dollar', category: 'commodities' },
                { symbol: 'US30', name: 'US Wall Street 30 Index', category: 'indices' },
                { symbol: 'US500', name: 'US 500 Index', category: 'indices' }
            ];
            filteredSymbols = [...allSymbols];
            updateSymbolCount();
        }
    }

    function updateSymbolCount() {
        if (symbolsConfig && symbolsConfig.version) {
            symbolCount.textContent = `${filteredSymbols.length} of ${allSymbols.length} symbols available (v${symbolsConfig.version})`;
        } else {
            symbolCount.textContent = `${filteredSymbols.length} symbols available`;
        }
    }

    function filterSymbols(query) {
        if (!query) {
            filteredSymbols = [...allSymbols];
        } else {
            filteredSymbols = allSymbols.filter(symbolInfo => 
                symbolInfo.symbol.toLowerCase().includes(query.toLowerCase()) ||
                symbolInfo.name.toLowerCase().includes(query.toLowerCase()) ||
                symbolInfo.category.toLowerCase().includes(query.toLowerCase())
            );
        }
        updateSymbolCount();
        showSymbolDropdown(query);
    }

    function showSymbolDropdown(query) {
        symbolDropdown.innerHTML = '';
        
        let symbolsToShow = [];
        let headerText = '';
        
        if (query && query.length > 0) {
            // Show filtered results
            symbolsToShow = filteredSymbols.slice(0, 15);
            headerText = filteredSymbols.length > 0 ? `${filteredSymbols.length} results found` : 'No symbols found';
        } else if (popularSymbols.length > 0) {
            // Show popular symbols when no query
            symbolsToShow = popularSymbols.slice(0, 8);
            headerText = '⭐ Popular Symbols';
        }
        
        if (symbolsToShow.length > 0) {
            // Add header if we have one
            if (headerText) {
                const header = document.createElement('div');
                header.style.cssText = `
                    padding: 8px 12px; 
                    background: #f8f9fa; 
                    font-size: 0.8em; 
                    font-weight: 600; 
                    color: #666; 
                    border-bottom: 1px solid #eee;
                `;
                header.textContent = headerText;
                symbolDropdown.appendChild(header);
            }
            
            symbolsToShow.forEach(symbolInfo => {
                const item = document.createElement('div');
                item.className = 'symbol-dropdown-item';
                
                // Enhanced display with icon, symbol, name and category
                item.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.2em;">${symbolInfo.categoryIcon || '📊'}</span>
                            <div>
                                <div style="font-weight: 600; color: #2a5298;">${symbolInfo.symbol}</div>
                                <div style="font-size: 0.85em; color: #666;">${symbolInfo.name}</div>
                            </div>
                        </div>
                        <span style="font-size: 0.75em; background: #f0f0f0; padding: 2px 6px; border-radius: 10px; color: #666;">
                            ${symbolInfo.categoryName || symbolInfo.category}
                        </span>
                    </div>
                `;
                
                item.addEventListener('click', () => {
                    tradeSymbol.value = symbolInfo.symbol;
                    symbolDropdown.style.display = 'none';
                    validateForm();
                });
                symbolDropdown.appendChild(item);
            });
            symbolDropdown.style.display = 'block';
        } else {
            symbolDropdown.style.display = 'none';
        }
    }

    // ==================== IMAGE ANALYSIS FUNCTIONS ====================

    function handleFile(file) {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
                analyzeButton.disabled = false;
            };
            reader.readAsDataURL(file);
            
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
        } else {
            alert('Por favor, selecciona un archivo de imagen válido.');
        }
    }

    function resetUpload() {
        imagePreview.style.display = 'none';
        analyzeButton.disabled = true;
        fileInput.value = '';
        aiAnalysisBox.style.display = 'none';
        extractedData = null;
        applyPlanButton.disabled = true;
    }

    function displayAnalysisResults(data) {
        const formatPrice = (price) => {
            return typeof price === 'number' ? price.toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 5
            }) : price;
        };

        const takeProfitsHtml = Array.isArray(data.take_profits) 
            ? data.take_profits.map((tp, index) => 
                `<span class="tp-item">TP${index + 1}: ${formatPrice(tp)}</span>`
              ).join('')
            : `<span class="tp-item">${formatPrice(data.take_profits)}</span>`;

        aiAnalysisContent.innerHTML = `
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px; border-radius: 8px;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; font-size: 0.9em;">
                    <div>
                        <strong>📈 Dirección:</strong>
                        <div style="margin-top: 3px;">
                            <span style="background: ${data.direction === 'Long' ? '#28a745' : '#dc3545'}; padding: 3px 8px; border-radius: 12px; font-size: 0.8em;">
                                ${data.direction}
                            </span>
                        </div>
                    </div>
                    <div>
                        <strong>🎯 Entrada:</strong>
                        <div style="font-family: monospace; margin-top: 3px;">
                            ${formatPrice(data.entry_price)}
                        </div>
                    </div>
                    <div>
                        <strong>🛑 Stop Loss:</strong>
                        <div style="font-family: monospace; margin-top: 3px; color: #ffcccb;">
                            ${formatPrice(data.stop_loss)}
                        </div>
                    </div>
                    <div>
                        <strong>💰 Take Profits:</strong>
                        <div style="margin-top: 3px; display: flex; flex-wrap: wrap; gap: 3px;">
                            ${takeProfitsHtml}
                        </div>
                    </div>
                </div>
            </div>
            <style>
                .tp-item {
                    background: rgba(255,255,255,0.2);
                    padding: 2px 6px;
                    border-radius: 8px;
                    font-family: monospace;
                    font-size: 0.75em;
                    white-space: nowrap;
                }
            </style>
        `;

        aiAnalysisBox.style.display = 'block';
        extractedData = data;
        applyPlanButton.disabled = false;
    }

    // ==================== TRADING FORM FUNCTIONS ====================

    function applyExtractedData() {
        if (!extractedData) return;

        // Apply direction
        if (extractedData.direction) {
            const direction = extractedData.direction.toLowerCase();
            formInputs.plan.value = direction === 'long' ? 'PLAN_LONG' : 'PLAN_SHORT';
        }

        // Apply entry price
        if (extractedData.entry_price) {
            formInputs.entryPoint.value = extractedData.entry_price;
        }

        // Apply stop loss
        if (extractedData.stop_loss) {
            formInputs.stopLoss.value = extractedData.stop_loss;
        }

        // Apply take profits
        if (extractedData.take_profits) {
            const tps = Array.isArray(extractedData.take_profits) ? 
                       extractedData.take_profits : [extractedData.take_profits];
            
            const tpInputs = [formInputs.tp1, formInputs.tp2, formInputs.tp3, formInputs.tp4, formInputs.tp5];
            
            // Clear existing TPs first
            tpInputs.forEach(input => input.value = '');
            
            // Apply new TPs
            tps.forEach((tp, index) => {
                if (index < tpInputs.length && tp) {
                    tpInputs[index].value = tp;
                }
            });
        }

        calculateRisk();
        validateForm();
        
        showSuccessMessage('✅ Datos aplicados al formulario exitosamente');
    }

    function calculateRisk() {
        const entryPrice = parseFloat(formInputs.entryPoint.value) || 0;
        const stopLoss = parseFloat(formInputs.stopLoss.value) || 0;
        const riskPercent = parseFloat(formInputs.riskPercent.value) || 2.0;
        const volume = parseFloat(formInputs.totalVolume.value) || 0;

        const riskCalculation = document.getElementById('riskCalculation');

        if (entryPrice && stopLoss && entryPrice !== stopLoss) {
            const priceDiff = Math.abs(entryPrice - stopLoss);
            const riskPoints = priceDiff;
            
            riskCalculation.innerHTML = `
                Risk per trade: ${riskPercent}%<br>
                Price difference: ${priceDiff.toFixed(5)}<br>
                Risk points: ${riskPoints.toFixed(5)}<br>
                ${volume > 0 ? `Fixed volume: ${volume}` : 'Volume: Based on risk %'}
            `;
        } else {
            riskCalculation.innerHTML = 'Enter entry price and stop loss to calculate risk';
        }
    }

    function validateForm() {
        let isValid = true;
        const errors = {};

        // Validate required fields
        if (!formInputs.tradeSymbol.value.trim()) {
            errors.tradeSymbol = 'Symbol is required';
            isValid = false;
        }

        if (!formInputs.stopLoss.value) {
            errors.stopLoss = 'Stop loss is required';
            isValid = false;
        }

        const entryPrice = parseFloat(formInputs.entryPoint.value);
        const stopLoss = parseFloat(formInputs.stopLoss.value);

        if (entryPrice && stopLoss && entryPrice === stopLoss) {
            errors.stopLoss = 'Stop loss must be different from entry price';
            isValid = false;
        }

        // Show/hide validation messages
        Object.keys(errors).forEach(field => {
            const validationEl = document.getElementById(`${field}-validation`);
            if (validationEl) {
                validationEl.textContent = errors[field];
                validationEl.classList.add('show');
            }
        });

        // Hide validation messages for valid fields
        Object.keys(formInputs).forEach(field => {
            if (!errors[field]) {
                const validationEl = document.getElementById(`${field}-validation`);
                if (validationEl) {
                    validationEl.classList.remove('show');
                }
            }
        });

        // Update validation status
        validationStatus.className = `status-indicator ${isValid ? 'status-valid' : 'status-invalid'}`;
        exportBtn.disabled = !isValid;

        return isValid;
    }

    function generateJSONOutput() {
        const tradingPlan = {
            metadata: {
                version: "1.0",
                created: new Date().toISOString(),
                application: "PlanScan"
            },
            symbol: formInputs.tradeSymbol.value,
            direction: formInputs.plan.value,
            entryType: formInputs.entryType.value,
            limitBehavior: formInputs.limitBehavior.value,
            prices: {
                entry: parseFloat(formInputs.entryPoint.value) || null,
                stopLoss: parseFloat(formInputs.stopLoss.value) || null,
                takeProfits: [
                    parseFloat(formInputs.tp1.value) || null,
                    parseFloat(formInputs.tp2.value) || null,
                    parseFloat(formInputs.tp3.value) || null,
                    parseFloat(formInputs.tp4.value) || null,
                    parseFloat(formInputs.tp5.value) || null
                ].filter(tp => tp !== null)
            },
            riskManagement: {
                totalVolume: parseFloat(formInputs.totalVolume.value) || 0,
                riskPercent: parseFloat(formInputs.riskPercent.value) || 2.0
            },
            settings: {
                slippage: parseInt(formInputs.slippage.value) || -1,
                orderComment: formInputs.orderComment.value || "PlanWithRisk"
            }
        };

        const jsonOutput = JSON.stringify(tradingPlan, null, 2);
        mt4Output.textContent = jsonOutput;
        return jsonOutput;
    }

    function exportJSONFile() {
        const content = generateJSONOutput();
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${formInputs.tradeSymbol.value || 'trading-plan'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showSuccessMessage('📁 Archivo JSON descargado exitosamente');
    }

    function importJSONFile(file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const content = event.target.result;
                const tradingPlan = JSON.parse(content);
                
                // Import data to form
                if (tradingPlan.symbol) formInputs.tradeSymbol.value = tradingPlan.symbol;
                if (tradingPlan.direction) formInputs.plan.value = tradingPlan.direction;
                if (tradingPlan.entryType) formInputs.entryType.value = tradingPlan.entryType;
                if (tradingPlan.limitBehavior) formInputs.limitBehavior.value = tradingPlan.limitBehavior;
                
                if (tradingPlan.prices) {
                    if (tradingPlan.prices.entry) formInputs.entryPoint.value = tradingPlan.prices.entry;
                    if (tradingPlan.prices.stopLoss) formInputs.stopLoss.value = tradingPlan.prices.stopLoss;
                    
                    if (tradingPlan.prices.takeProfits) {
                        const tpInputs = [formInputs.tp1, formInputs.tp2, formInputs.tp3, formInputs.tp4, formInputs.tp5];
                        tradingPlan.prices.takeProfits.forEach((tp, index) => {
                            if (index < tpInputs.length && tp) {
                                tpInputs[index].value = tp;
                            }
                        });
                    }
                }
                
                if (tradingPlan.riskManagement) {
                    if (tradingPlan.riskManagement.totalVolume !== undefined) {
                        formInputs.totalVolume.value = tradingPlan.riskManagement.totalVolume;
                    }
                    if (tradingPlan.riskManagement.riskPercent !== undefined) {
                        formInputs.riskPercent.value = tradingPlan.riskManagement.riskPercent;
                    }
                }
                
                if (tradingPlan.settings) {
                    if (tradingPlan.settings.slippage !== undefined) {
                        formInputs.slippage.value = tradingPlan.settings.slippage;
                    }
                    if (tradingPlan.settings.orderComment) {
                        formInputs.orderComment.value = tradingPlan.settings.orderComment;
                    }
                }
                
                validateForm();
                calculateRisk();
                showSuccessMessage('✅ Archivo JSON importado correctamente');
            } catch (error) {
                console.error('Error importing JSON:', error);
                alert('❌ Error al importar el archivo JSON. Verifica que sea un archivo válido.');
            }
        };
        reader.readAsText(file);
    }

    function clearForm() {
        if (confirm('¿Estás seguro de que quieres limpiar todo el formulario?')) {
            form.reset();
            formInputs.riskPercent.value = '2.0';
            formInputs.slippage.value = '-1';
            formInputs.orderComment.value = 'PlanWithRisk';
            formInputs.totalVolume.value = '0';
            resetUpload();
            validateForm();
            mt4Output.textContent = '// Click "Validate Plan" to generate JSON trading plan...';
            showSuccessMessage('🔄 Formulario limpiado');
        }
    }

    function showSuccessMessage(message) {
        const successMsg = document.createElement('div');
        successMsg.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: #28a745; color: white; padding: 15px 20px;
            border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideInRight 0.3s ease-out;
        `;
        successMsg.innerHTML = message;
        document.body.appendChild(successMsg);
        
        setTimeout(() => {
            successMsg.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (document.body.contains(successMsg)) {
                    document.body.removeChild(successMsg);
                }
            }, 300);
        }, 3000);
    }

    // ==================== EVENT LISTENERS ====================

    function initializeEventListeners() {
        // Image upload events
        fileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                handleFile(file);
            } else {
                resetUpload();
            }
        });

        // Drag & Drop events
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFile(files[0]);
            }
        });

        // Paste events
        pasteButton.addEventListener('click', async function() {
            try {
                const clipboardItems = await navigator.clipboard.read();
                for (const clipboardItem of clipboardItems) {
                    for (const type of clipboardItem.types) {
                        if (type.startsWith('image/')) {
                            const blob = await clipboardItem.getType(type);
                            const file = new File([blob], 'pasted-image.png', { type: blob.type });
                            handleFile(file);
                            return;
                        }
                    }
                }
                alert('No se encontró ninguna imagen en el portapapeles.');
            } catch (error) {
                console.error('Error al acceder al portapapeles:', error);
                alert('Error al acceder al portapapeles. Asegúrate de dar permisos al navegador.');
            }
        });

        document.addEventListener('paste', async function(e) {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                const clipboardData = e.clipboardData || window.clipboardData;
                const items = clipboardData.items;
                
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith('image/')) {
                        const blob = items[i].getAsFile();
                        if (blob) {
                            handleFile(blob);
                            return;
                        }
                    }
                }
            }
        });

        // AI Analysis button
        analyzeButton.addEventListener('click', async function() {
            const file = fileInput.files[0];
            if (!file) {
                alert('Por favor, selecciona una imagen primero.');
                return;
            }

            loadingIndicator.style.display = 'block';
            aiAnalysisContent.innerHTML = '';
            analyzeButton.disabled = true;

            try {
                const formData = new FormData();
                formData.append('tradingImage', file);

                const response = await fetch('/analyze', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Error del servidor: ${response.status}`);
                }

                const result = await response.json();

                if (result.error) {
                    throw new Error(result.error);
                }

                displayAnalysisResults(result);

            } catch (error) {
                console.error('Error en el análisis:', error);
                aiAnalysisContent.innerHTML = `
                    <div style="color: #dc3545; padding: 15px; border: 1px solid #dc3545; border-radius: 8px; background-color: #f8d7da;">
                        <h4>❌ Error en el análisis</h4>
                        <p><strong>Mensaje:</strong> ${error.message}</p>
                        <p><strong>Sugerencias:</strong></p>
                        <ul>
                            <li>Verifica que el servidor esté ejecutándose en https://planscan.holancloud.com</li>
                            <li>Asegúrate de que la imagen sea clara y contenga un plan de trading</li>
                            <li>Comprueba que tengas configurada la clave de API de Gemini</li>
                        </ul>
                    </div>
                `;
                aiAnalysisBox.style.display = 'block';
            } finally {
                loadingIndicator.style.display = 'none';
                analyzeButton.disabled = false;
            }
        });

        // Apply extracted data button
        applyPlanButton.addEventListener('click', applyExtractedData);

        // Symbol search
        tradeSymbol.addEventListener('input', function(e) {
            filterSymbols(e.target.value);
            validateForm();
        });

        tradeSymbol.addEventListener('focus', function() {
            // Show dropdown when focused (either filtered results or popular symbols)
            if (this.value.trim()) {
                filterSymbols(this.value);
            } else {
                showSymbolDropdown('');
            }
        });

        tradeSymbol.addEventListener('blur', function() {
            setTimeout(() => {
                symbolDropdown.style.display = 'none';
            }, 200);
        });

        // Form validation on input changes
        Object.values(formInputs).forEach(input => {
            input.addEventListener('input', function() {
                calculateRisk();
                validateForm();
            });
        });

        // Entry type change - show/hide limit behavior
        formInputs.entryType.addEventListener('change', function() {
            const limitBehaviorGroup = document.getElementById('limitBehaviorGroup');
            const entryPointGroup = document.getElementById('entryPointGroup');
            
            if (this.value === 'ENTRY_MARKET') {
                limitBehaviorGroup.style.display = 'none';
                entryPointGroup.style.display = 'none';
            } else {
                limitBehaviorGroup.style.display = 'block';
                entryPointGroup.style.display = 'block';
            }
            validateForm();
        });

        // Action buttons
        validateBtn.addEventListener('click', function() {
            if (validateForm()) {
                generateJSONOutput();
                showSuccessMessage('✅ Plan validado correctamente. Ahora puedes exportar el archivo JSON');
            } else {
                alert('❌ Por favor, corrige los errores en el formulario antes de validar.');
            }
        });

        exportBtn.addEventListener('click', exportJSONFile);
        clearBtn.addEventListener('click', clearForm);

        // Instructions button and modal
        instructionsBtn.addEventListener('click', function() {
            instructionsModal.style.display = 'block';
        });

        closeInstructionsModal.addEventListener('click', function() {
            instructionsModal.style.display = 'none';
        });

        window.addEventListener('click', function(event) {
            if (event.target === instructionsModal) {
                instructionsModal.style.display = 'none';
            }
        });

        // Import functionality
        importBtn.addEventListener('click', () => importFile.click());
        
        importFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                importJSONFile(file);
            }
        });

        // Initialize form state
        validateForm();
        calculateRisk();
    }

    // Add CSS animations for notifications
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
});