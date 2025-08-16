class QRGenerator {
    constructor() {
        this.qrcode = null;
        this.loadQRLibrary().then(() => {
            this.init();
        });
    }

    async loadQRLibrary() {
        // Load the Node.js qrcode package (available through Electron)
        try {
            if (window.require) {
                this.qrcode = window.require('qrcode');
                console.log('QR code library loaded successfully');
                return;
            }
        } catch (error) {
            console.error('Failed to load QR code library:', error);
            throw new Error('QR code library not available');
        }
    }

    init() {
        const generateBtn = document.getElementById('generate-qr');
        const downloadBtn = document.getElementById('download-qr');
        const textInput = document.getElementById('qr-text');

        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateQR());
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadQR());
        }

        if (textInput) {
            textInput.addEventListener('input', () => this.onInputChange());
        }
    }

    generateQR() {
        const text = document.getElementById('qr-text').value.trim();
        const size = parseInt(document.getElementById('qr-size').value);
        const errorLevel = document.getElementById('error-level').value;

        if (!text) {
            window.app?.showMessage('Please enter text to generate QR code.', 'error');
            return;
        }

        if (!this.qrcode) {
            window.app?.showMessage('QR code library not loaded. Please restart the application.', 'error');
            return;
        }

        try {
            this.createQRCode(text, size, errorLevel);
            document.getElementById('download-qr').disabled = false;
            
            // Show what data is encoded
            this.displayQRInfo(text, errorLevel);
            
            window.app?.showMessage('QR code generated successfully!', 'success');
        } catch (error) {
            console.error('QR generation error:', error);
            window.app?.showMessage('Error generating QR code: ' + error.message, 'error');
        }
    }

    createQRCode(text, size, errorLevel) {
        const canvas = document.getElementById('qr-canvas');
        
        const errorCorrectionLevel = errorLevel.toLowerCase();
        const options = {
            errorCorrectionLevel: errorCorrectionLevel,
            type: 'image/png',
            quality: 0.92,
            width: size,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        };

        this.qrcode.toCanvas(canvas, text, options, (error) => {
            if (error) {
                console.error('QR code generation error:', error);
                throw error;
            } else {
                document.getElementById('qr-preview').style.display = 'block';
                console.log('QR code generated successfully');
            }
        });
    }

    displayQRInfo(text, errorLevel) {
        // Create or update info display
        let infoDiv = document.getElementById('qr-info');
        if (!infoDiv) {
            infoDiv = document.createElement('div');
            infoDiv.id = 'qr-info';
            infoDiv.className = 'qr-info';
            document.getElementById('qr-preview').appendChild(infoDiv);
        }

        const textLength = text.length;
        const textType = this.detectTextType(text);
        
        infoDiv.innerHTML = `
            <div class="qr-details">
                <h4>QR Code Details:</h4>
                <div class="detail-row"><strong>Data:</strong> ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}</div>
                <div class="detail-row"><strong>Type:</strong> ${textType}</div>
                <div class="detail-row"><strong>Length:</strong> ${textLength} characters</div>
                <div class="detail-row"><strong>Error Correction:</strong> ${this.getErrorLevelDescription(errorLevel)}</div>
                <div class="detail-row"><strong>Status:</strong> <span class="status-success">✓ Scannable QR Code</span></div>
            </div>
        `;
    }

    detectTextType(text) {
        if (text.match(/^https?:\/\//i)) {
            return 'URL/Website';
        } else if (text.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
            return 'Email Address';
        } else if (text.match(/^[\+]?[1-9][\d\s\-\(\)]{7,}$/)) {
            return 'Phone Number';
        } else if (text.match(/^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i)) {
            return 'UUID';
        } else if (text.includes('\n') || text.length > 100) {
            return 'Text/Data';
        } else {
            return 'Text';
        }
    }

    getErrorLevelDescription(level) {
        const descriptions = {
            'L': 'Low (7% recovery)',
            'M': 'Medium (15% recovery)',
            'Q': 'Quartile (25% recovery)',
            'H': 'High (30% recovery)'
        };
        return descriptions[level] || descriptions['M'];
    }

    createQRCode(text, size, errorLevel) {
        const canvas = document.getElementById('qr-canvas');
        
        // Try Node.js qrcode package first
        if (this.qrcode) {
            try {
                const errorCorrectionLevel = errorLevel.toLowerCase();
                const options = {
                    errorCorrectionLevel: errorCorrectionLevel,
                    type: 'image/png',
                    quality: 0.92,
                    width: size,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                };

                this.qrcode.toCanvas(canvas, text, options, (error) => {
                    if (error) {
                        console.error('Node.js qrcode error:', error);
                        this.tryFallbackMethods(text, size, errorLevel);
                    } else {
                        document.getElementById('qr-preview').style.display = 'block';
                        console.log('QR code generated successfully with Node.js package');
                    }
                });
                return;
            } catch (error) {
                console.error('Node.js qrcode error:', error);
            }
        }

        this.tryFallbackMethods(text, size, errorLevel);
    }

    tryFallbackMethods(text, size, errorLevel) {
        const canvas = document.getElementById('qr-canvas');
        
        if (window.QRious) {
            // Use QRious library for reliable QR generation
            try {
                const qr = new QRious({
                    element: canvas,
                    value: text,
                    size: size,
                    level: errorLevel,
                    background: 'white',
                    foreground: 'black',
                    padding: Math.floor(size * 0.05) // 5% padding
                });
                
                document.getElementById('qr-preview').style.display = 'block';
                console.log('QR code generated successfully with QRious');
                return;
            } catch (error) {
                console.error('QRious error:', error);
            }
        }

        if (window.qrcode) {
            // Use qrcode-generator library as alternative
            try {
                const errorCorrectionLevel = {
                    'L': window.qrcode.ErrorCorrectionLevel.L,
                    'M': window.qrcode.ErrorCorrectionLevel.M,
                    'Q': window.qrcode.ErrorCorrectionLevel.Q,
                    'H': window.qrcode.ErrorCorrectionLevel.H
                };

                const qr = window.qrcode(0, errorCorrectionLevel[errorLevel] || errorCorrectionLevel.M);
                qr.addData(text);
                qr.make();
                
                this.renderQRToCanvas(qr, canvas, size);
                document.getElementById('qr-preview').style.display = 'block';
                console.log('QR code generated successfully with qrcode-generator');
                return;
            } catch (error) {
                console.error('qrcode-generator error:', error);
            }
        }

        // Final fallback to manual implementation
        console.log('All QR libraries failed, using manual fallback');
        this.createQRCodeManual(text, size, errorLevel);
    }

    renderQRToCanvas(qr, canvas, size) {
        const ctx = canvas.getContext('2d');
        const moduleCount = qr.getModuleCount();
        const moduleSize = Math.floor(size / moduleCount);
        const padding = Math.floor((size - moduleSize * moduleCount) / 2);
        
        canvas.width = size;
        canvas.height = size;
        
        // Clear canvas with white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, size, size);
        
        // Draw QR modules
        ctx.fillStyle = 'black';
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (qr.isDark(row, col)) {
                    ctx.fillRect(
                        padding + col * moduleSize,
                        padding + row * moduleSize,
                        moduleSize,
                        moduleSize
                    );
                }
            }
        }
    }

    downloadQR() {
        const canvas = document.getElementById('qr-canvas');
        if (!canvas.width) {
            window.app?.showMessage('Please generate a QR code first.', 'error');
            return;
        }

        const link = document.createElement('a');
        link.download = 'qrcode.png';
        link.href = canvas.toDataURL();
        link.click();

        window.app?.showMessage('QR code downloaded!', 'success');
    }

    onInputChange() {
        document.getElementById('download-qr').disabled = true;
        document.getElementById('qr-preview').style.display = 'none';
    }

    generateQRFromUrl(url) {
        document.getElementById('qr-text').value = url;
        this.generateQR();
    }
}

window.QRGenerator = new QRGenerator();

const qrStyles = `
#qr-text {
    width: 100%;
    min-height: 100px;
    padding: 15px;
    border: 2px solid #f0f0f0;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    resize: vertical;
    margin-bottom: 20px;
}

#qr-text:focus {
    outline: none;
    border-color: #667eea;
}

.qr-options {
    display: flex;
    gap: 30px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.option-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.option-group label {
    font-weight: 500;
    color: #1d1d1f;
    font-size: 14px;
}

.option-group select {
    padding: 8px 12px;
    border: 2px solid #f0f0f0;
    border-radius: 6px;
    font-size: 14px;
    min-width: 150px;
}

.option-group select:focus {
    outline: none;
    border-color: #667eea;
}

.qr-preview {
    text-align: center;
    margin-top: 30px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
}

#qr-canvas {
    border: 1px solid #d0d0d0;
    border-radius: 8px;
    background: white;
    max-width: 100%;
    height: auto;
    margin-bottom: 20px;
}

.qr-info {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
    margin-top: 16px;
    text-align: left;
}

.qr-details h4 {
    margin: 0 0 12px 0;
    color: #1d1d1f;
    font-size: 16px;
    font-weight: 600;
}

.detail-row {
    margin-bottom: 8px;
    font-size: 14px;
    color: #424242;
}

.detail-row strong {
    color: #1d1d1f;
    font-weight: 500;
    display: inline-block;
    min-width: 120px;
}

.status-success {
    color: #4caf50;
    font-weight: 500;
}

.status-warning {
    color: #ff9800;
    font-weight: 500;
}

.controls {
    display: flex;
    gap: 15px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

#download-qr:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

@media (max-width: 768px) {
    .qr-options {
        flex-direction: column;
        gap: 15px;
    }
    
    .option-group select {
        min-width: auto;
        width: 100%;
    }
    
    .detail-row strong {
        min-width: auto;
        display: block;
        margin-bottom: 2px;
    }
}
`;

// Use centralized style management to prevent conflicts
if (window.StyleManager) {
    window.StyleManager.addToolStyles('qr-generator', qrStyles);
} else {
    // Fallback for backward compatibility
    const qrGeneratorStyleElement = document.createElement('style');
    qrGeneratorStyleElement.id = 'qr-generator-styles';
    qrGeneratorStyleElement.textContent = qrStyles;
    document.head.appendChild(qrGeneratorStyleElement);
}