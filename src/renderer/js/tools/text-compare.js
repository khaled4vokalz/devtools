class TextCompare {
    constructor() {
        this.init();
    }

    init() {
        const compareBtn = document.getElementById('compare-texts');
        const clearBtn = document.getElementById('clear-comparison');
        const diffModeSelect = document.getElementById('diff-mode');

        if (compareBtn) {
            compareBtn.addEventListener('click', () => this.compareTexts());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearComparison());
        }

        if (diffModeSelect) {
            diffModeSelect.addEventListener('change', () => {
                if (document.getElementById('comparison-result').innerHTML.trim()) {
                    this.compareTexts();
                }
            });
        }
    }

    compareTexts() {
        const text1 = document.getElementById('text1').value;
        const text2 = document.getElementById('text2').value;
        const resultDiv = document.getElementById('comparison-result');
        const diffMode = document.getElementById('diff-mode')?.value || 'side-by-side';

        if (!text1.trim() && !text2.trim()) {
            resultDiv.innerHTML = '<div class="error">Please enter text in both fields to compare.</div>';
            return;
        }

        if (!text1.trim() || !text2.trim()) {
            resultDiv.innerHTML = '<div class="warning">One of the text fields is empty. Showing comparison with empty content.</div>';
        }

        const diffResult = this.generateUnifiedDiff(text1, text2);
        const stats = this.getComparisonStats(text1, text2, diffResult.changes);

        let diffHTML = '';
        if (diffMode === 'unified') {
            diffHTML = this.renderUnifiedDiff(diffResult);
        } else {
            diffHTML = this.renderSideBySideDiff(text1, text2, diffResult);
        }

        resultDiv.innerHTML = `
            <div class="comparison-stats">
                <h3>Comparison Results</h3>
                <div class="stats-grid">
                    <div class="stat">
                        <label>Text 1 Length:</label>
                        <span>${stats.text1Length} characters (${stats.text1Lines} lines)</span>
                    </div>
                    <div class="stat">
                        <label>Text 2 Length:</label>
                        <span>${stats.text2Length} characters (${stats.text2Lines} lines)</span>
                    </div>
                    <div class="stat">
                        <label>Similarity:</label>
                        <span class="similarity-score">${stats.similarity}%</span>
                    </div>
                    <div class="stat">
                        <label>Changes:</label>
                        <span class="changes-count">+${stats.additions} -${stats.deletions} ~${stats.modifications}</span>
                    </div>
                </div>
            </div>
            ${diffHTML}
        `;

        window.app?.showMessage('Text comparison completed!', 'success');
    }

    generateUnifiedDiff(text1, text2) {
        const lines1 = text1.split('\n');
        const lines2 = text2.split('\n');
        
        // Use Myers algorithm for better diff
        const diff = this.myersDiff(lines1, lines2);
        const changes = this.processDiffChanges(diff);
        
        return {
            changes,
            lines1,
            lines2,
            diffOperations: diff
        };
    }

    myersDiff(a, b) {
        const n = a.length;
        const m = b.length;
        const max = n + m;
        
        const v = {};
        v[1] = 0;
        const trace = [];
        
        for (let d = 0; d <= max; d++) {
            trace.push({ ...v });
            
            for (let k = -d; k <= d; k += 2) {
                let x;
                if (k === -d || (k !== d && v[k - 1] < v[k + 1])) {
                    x = v[k + 1];
                } else {
                    x = v[k - 1] + 1;
                }
                
                let y = x - k;
                
                while (x < n && y < m && a[x] === b[y]) {
                    x++;
                    y++;
                }
                
                v[k] = x;
                
                if (x >= n && y >= m) {
                    return this.buildPath(trace, a, b, n, m, d);
                }
            }
        }
        
        return [];
    }
    
    buildPath(trace, a, b, n, m, d) {
        const path = [];
        let x = n;
        let y = m;
        
        for (let i = d; i >= 0; i--) {
            const v = trace[i];
            const k = x - y;
            
            let prevK;
            if (k === -i || (k !== i && v[k - 1] < v[k + 1])) {
                prevK = k + 1;
            } else {
                prevK = k - 1;
            }
            
            const prevX = v[prevK];
            const prevY = prevX - prevK;
            
            while (x > prevX && y > prevY) {
                path.unshift({ type: 'equal', oldLine: x - 1, newLine: y - 1, line: a[x - 1] });
                x--;
                y--;
            }
            
            if (i > 0) {
                if (x > prevX) {
                    path.unshift({ type: 'delete', oldLine: x - 1, newLine: -1, line: a[x - 1] });
                    x--;
                } else {
                    path.unshift({ type: 'insert', oldLine: -1, newLine: y - 1, line: b[y - 1] });
                    y--;
                }
            }
        }
        
        // Post-process to detect intra-line changes
        return this.detectIntraLineChanges(path, a, b);
    }
    
    detectIntraLineChanges(path, linesA, linesB) {
        const processedPath = [];
        
        for (let i = 0; i < path.length; i++) {
            const current = path[i];
            
            // Look for adjacent delete/insert pairs that might be modifications
            if (current.type === 'delete' && i + 1 < path.length && path[i + 1].type === 'insert') {
                const deletedLine = current.line;
                const insertedLine = path[i + 1].line;
                
                // Calculate similarity between the two lines
                const similarity = this.calculateLineSimilarity(deletedLine, insertedLine);
                
                // If lines are similar enough (>50% similarity), treat as modification
                if (similarity > 0.5) {
                    const wordDiff = this.getWordLevelDiff(deletedLine, insertedLine);
                    processedPath.push({
                        type: 'modify',
                        oldLine: current.oldLine,
                        newLine: path[i + 1].newLine,
                        oldContent: deletedLine,
                        newContent: insertedLine,
                        wordDiff: wordDiff
                    });
                    i++; // Skip the next insert since we've processed it
                } else {
                    processedPath.push(current);
                }
            } else {
                processedPath.push(current);
            }
        }
        
        return processedPath;
    }
    
    calculateLineSimilarity(line1, line2) {
        if (!line1 || !line2) return 0;
        
        const words1 = line1.split(/\s+/).filter(w => w.length > 0);
        const words2 = line2.split(/\s+/).filter(w => w.length > 0);
        
        const maxLen = Math.max(words1.length, words2.length);
        if (maxLen === 0) return 1;
        
        let commonWords = 0;
        const used = new Set();
        
        for (const word1 of words1) {
            for (let j = 0; j < words2.length; j++) {
                if (!used.has(j) && word1.toLowerCase() === words2[j].toLowerCase()) {
                    commonWords++;
                    used.add(j);
                    break;
                }
            }
        }
        
        return commonWords / maxLen;
    }
    
    getWordLevelDiff(oldLine, newLine) {
        const oldWords = oldLine.split(/(\s+)/);
        const newWords = newLine.split(/(\s+)/);
        
        const wordDiff = this.myersDiff(oldWords, newWords);
        
        return wordDiff.map(op => ({
            type: op.type,
            content: op.line
        }));
    }
    
    processDiffChanges(diffOps) {
        let additions = 0;
        let deletions = 0;
        let modifications = 0;
        
        for (const op of diffOps) {
            if (op.type === 'insert') additions++;
            else if (op.type === 'delete') deletions++;
            else if (op.type === 'modify') modifications++;
        }
        
        return { additions, deletions, modifications, total: diffOps.length };
    }

    renderUnifiedDiff(diffResult) {
        const { diffOperations, lines1, lines2 } = diffResult;
        
        let html = '<div class="unified-diff-view">';
        html += '<div class="diff-header">';
        html += '<div class="diff-file-header">--- Text 1</div>';
        html += '<div class="diff-file-header">+++ Text 2</div>';
        html += '</div>';
        html += '<div class="unified-diff-content">';
        
        let lineNumber1 = 1;
        let lineNumber2 = 1;
        let hunkStart1 = 1;
        let hunkStart2 = 1;
        let hunkLines = [];
        
        for (let i = 0; i < diffOperations.length; i++) {
            const op = diffOperations[i];
            
            switch (op.type) {
                case 'equal':
                    if (hunkLines.length > 0 && this.shouldCreateHunk(diffOperations, i)) {
                        html += this.renderHunk(hunkStart1, hunkStart2, hunkLines);
                        hunkLines = [];
                        hunkStart1 = lineNumber1;
                        hunkStart2 = lineNumber2;
                    }
                    hunkLines.push({
                        type: 'context',
                        line: this.escapeHtml(op.line),
                        lineNumber1: lineNumber1,
                        lineNumber2: lineNumber2
                    });
                    lineNumber1++;
                    lineNumber2++;
                    break;
                    
                case 'delete':
                    hunkLines.push({
                        type: 'delete',
                        line: this.escapeHtml(op.line),
                        lineNumber1: lineNumber1,
                        lineNumber2: null
                    });
                    lineNumber1++;
                    break;
                    
                case 'insert':
                    hunkLines.push({
                        type: 'insert',
                        line: this.escapeHtml(op.line),
                        lineNumber1: null,
                        lineNumber2: lineNumber2
                    });
                    lineNumber2++;
                    break;
                    
                case 'modify':
                    const inlineWordDiff = this.renderInlineWordDiff(op.oldContent, op.newContent);
                    hunkLines.push({
                        type: 'modify',
                        line: inlineWordDiff,
                        lineNumber1: lineNumber1,
                        lineNumber2: lineNumber2
                    });
                    lineNumber1++;
                    lineNumber2++;
                    break;
            }
        }
        
        if (hunkLines.length > 0) {
            html += this.renderHunk(hunkStart1, hunkStart2, hunkLines);
        }
        
        html += '</div></div>';
        return html;
    }
    
    shouldCreateHunk(operations, currentIndex) {
        // Create a new hunk if we have 3+ consecutive equal lines
        let consecutiveEqual = 0;
        for (let i = currentIndex; i < operations.length && operations[i].type === 'equal'; i++) {
            consecutiveEqual++;
        }
        return consecutiveEqual >= 3;
    }
    
    renderHunk(start1, start2, hunkLines) {
        const contextLines = hunkLines.filter(h => h.type === 'context').length;
        const addLines = hunkLines.filter(h => h.type === 'insert').length;
        const delLines = hunkLines.filter(h => h.type === 'delete').length;
        const modifyLines = hunkLines.filter(h => h.type === 'modify').length;
        
        let html = `<div class="diff-hunk-header">@@ -${start1},${contextLines + delLines + modifyLines} +${start2},${contextLines + addLines + modifyLines} @@</div>`;
        
        for (const hunkLine of hunkLines) {
            let lineClass = `diff-line diff-${hunkLine.type}`;
            let prefix = ' ';
            
            switch (hunkLine.type) {
                case 'insert':
                    prefix = '+';
                    break;
                case 'delete':
                    prefix = '-';
                    break;
                case 'modify':
                    prefix = '~';
                    break;
            }
            
            const lineNumbers = this.formatLineNumbers(hunkLine.lineNumber1, hunkLine.lineNumber2);
            
            html += `<div class="${lineClass}">`;
            html += `<span class="line-numbers">${lineNumbers}</span>`;
            html += `<span class="line-prefix">${prefix}</span>`;
            html += `<span class="line-content">${hunkLine.line || ''}</span>`;
            html += `</div>`;
        }
        
        return html;
    }
    
    formatLineNumbers(line1, line2) {
        const num1 = line1 !== null ? line1.toString().padStart(4) : '    ';
        const num2 = line2 !== null ? line2.toString().padStart(4) : '    ';
        return `${num1} ${num2}`;
    }

    renderSideBySideDiff(text1, text2, diffResult) {
        const { diffOperations } = diffResult;
        
        let html = '<div class="side-by-side-diff-view">';
        html += '<div class="diff-columns">';
        html += '<div class="diff-column">';
        html += '<h4><i class="fas fa-minus-circle"></i> Text 1</h4>';
        html += '<div class="diff-content">';
        
        let lineNumber1 = 1;
        for (const op of diffOperations) {
            if (op.type === 'equal') {
                html += `<div class="diff-line">`;
                html += `<span class="line-number">${lineNumber1}</span>`;
                html += `<span class="line-content">${this.escapeHtml(op.line)}</span>`;
                html += `</div>`;
                lineNumber1++;
            } else if (op.type === 'delete') {
                html += `<div class="diff-line diff-removed">`;
                html += `<span class="line-number">${lineNumber1}</span>`;
                html += `<span class="line-content">${this.escapeHtml(op.line)}</span>`;
                html += `</div>`;
                lineNumber1++;
            } else if (op.type === 'modify') {
                const wordDiff = this.renderWordLevelDiff(op.oldContent, op.newContent);
                html += `<div class="diff-line diff-modified">`;
                html += `<span class="line-number">${lineNumber1}</span>`;
                html += `<span class="line-content">${wordDiff.oldHtml}</span>`;
                html += `</div>`;
                lineNumber1++;
            } else if (op.type === 'insert') {
                // Add empty line for insertions to maintain alignment
                html += `<div class="diff-line diff-empty">`;
                html += `<span class="line-number"></span>`;
                html += `<span class="line-content"></span>`;
                html += `</div>`;
            }
        }
        
        html += '</div></div>';
        html += '<div class="diff-column">';
        html += '<h4><i class="fas fa-plus-circle"></i> Text 2</h4>';
        html += '<div class="diff-content">';
        
        let lineNumber2 = 1;
        for (const op of diffOperations) {
            if (op.type === 'equal') {
                html += `<div class="diff-line">`;
                html += `<span class="line-number">${lineNumber2}</span>`;
                html += `<span class="line-content">${this.escapeHtml(op.line)}</span>`;
                html += `</div>`;
                lineNumber2++;
            } else if (op.type === 'insert') {
                html += `<div class="diff-line diff-added">`;
                html += `<span class="line-number">${lineNumber2}</span>`;
                html += `<span class="line-content">${this.escapeHtml(op.line)}</span>`;
                html += `</div>`;
                lineNumber2++;
            } else if (op.type === 'modify') {
                const wordDiff = this.renderWordLevelDiff(op.oldContent, op.newContent);
                html += `<div class="diff-line diff-modified">`;
                html += `<span class="line-number">${lineNumber2}</span>`;
                html += `<span class="line-content">${wordDiff.newHtml}</span>`;
                html += `</div>`;
                lineNumber2++;
            } else if (op.type === 'delete') {
                // Add empty line for deletions to maintain alignment
                html += `<div class="diff-line diff-empty">`;
                html += `<span class="line-number"></span>`;
                html += `<span class="line-content"></span>`;
                html += `</div>`;
            }
        }
        
        html += '</div></div>';
        html += '</div></div>';
        
        return html;
    }
    
    renderWordDiff(content, diffType) {
        if (!content) return '';
        return this.escapeHtml(content);
    }

    renderWordLevelDiff(oldContent, newContent) {
        if (!oldContent || !newContent) {
            return {
                oldHtml: oldContent ? this.escapeHtml(oldContent) : '',
                newHtml: newContent ? this.escapeHtml(newContent) : ''
            };
        }

        const oldWords = oldContent.split(/(\s+)/);
        const newWords = newContent.split(/(\s+)/);
        
        // Use Myers algorithm on words
        const wordDiff = this.myersDiff(oldWords, newWords);
        
        let oldHtml = '';
        let newHtml = '';
        
        for (const op of wordDiff) {
            const escapedWord = this.escapeHtml(op.line);
            
            switch (op.type) {
                case 'equal':
                    oldHtml += escapedWord;
                    newHtml += escapedWord;
                    break;
                    
                case 'delete':
                    oldHtml += `<span class="word-delete">${escapedWord}</span>`;
                    break;
                    
                case 'insert':
                    newHtml += `<span class="word-insert">${escapedWord}</span>`;
                    break;
            }
        }
        
        return { oldHtml, newHtml };
    }

    renderInlineWordDiff(oldContent, newContent) {
        if (!oldContent || !newContent) {
            if (oldContent) return `<span class="word-delete">${this.escapeHtml(oldContent)}</span>`;
            if (newContent) return `<span class="word-insert">${this.escapeHtml(newContent)}</span>`;
            return '';
        }

        const oldWords = oldContent.split(/(\s+)/);
        const newWords = newContent.split(/(\s+)/);
        
        // Use Myers algorithm on words
        const wordDiff = this.myersDiff(oldWords, newWords);
        
        let inlineHtml = '';
        
        for (const op of wordDiff) {
            const escapedWord = this.escapeHtml(op.line);
            
            switch (op.type) {
                case 'equal':
                    inlineHtml += escapedWord;
                    break;
                    
                case 'delete':
                    inlineHtml += `<span class="word-delete">${escapedWord}</span>`;
                    break;
                    
                case 'insert':
                    inlineHtml += `<span class="word-insert">${escapedWord}</span>`;
                    break;
            }
        }
        
        return inlineHtml;
    }

    getComparisonStats(text1, text2, changes) {
        const text1Length = text1.length;
        const text2Length = text2.length;
        const text1Lines = text1.split('\n').length;
        const text2Lines = text2.split('\n').length;
        
        const similarity = this.calculateSimilarity(text1, text2);

        return {
            text1Length,
            text2Length,
            text1Lines,
            text2Lines,
            similarity: Math.round(similarity * 100),
            additions: changes.additions || 0,
            deletions: changes.deletions || 0,
            modifications: changes.modifications || 0
        };
    }

    calculateSimilarity(text1, text2) {
        const longer = text1.length > text2.length ? text1 : text2;
        const shorter = text1.length > text2.length ? text2 : text1;

        if (longer.length === 0) {
            return 1.0;
        }

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    clearComparison() {
        document.getElementById('text1').value = '';
        document.getElementById('text2').value = '';
        document.getElementById('comparison-result').innerHTML = '';
        window.app?.showMessage('Comparison cleared!', 'info');
    }
}

window.TextCompare = new TextCompare();

const additionalStyles = `
.comparison-stats {
    margin-bottom: 20px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e9ecef;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 15px;
    margin-top: 15px;
}

.stat {
    display: flex;
    justify-content: space-between;
    padding: 12px 16px;
    background: white;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.stat label {
    font-weight: 600;
    color: #495057;
}

.stat span {
    font-weight: 500;
}

.similarity-score {
    color: #28a745;
    font-weight: 600;
}

.changes-count {
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 0.9em;
    color: #6f42c1;
}

.diff-mode-selector {
    margin-bottom: 15px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e9ecef;
}

.diff-mode-selector label {
    font-weight: 600;
    color: #495057;
    margin-right: 10px;
}

.diff-mode-selector select {
    padding: 8px 12px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    background: white;
    font-size: 14px;
}

/* Unified Diff Styles */
.unified-diff-view {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    overflow: hidden;
    font-family: 'JetBrains Mono', 'Monaco', 'Consolas', monospace;
    font-size: 13px;
}

.diff-header {
    background: #495057;
    color: white;
    padding: 12px 16px;
}

.diff-file-header {
    font-weight: 600;
    margin: 2px 0;
}

.unified-diff-content {
    max-height: 500px;
    overflow-y: auto;
    background: white;
}

.diff-hunk-header {
    background: #e9ecef;
    color: #495057;
    padding: 8px 16px;
    font-weight: 600;
    border-top: 1px solid #dee2e6;
    border-bottom: 1px solid #dee2e6;
    font-size: 12px;
}

.diff-line {
    display: flex;
    align-items: center;
    padding: 2px 0;
    border-bottom: 1px solid #f8f9fa;
    min-height: 20px;
}

.line-numbers {
    background: #f8f9fa;
    padding: 0 8px;
    color: #6c757d;
    font-size: 11px;
    border-right: 1px solid #e9ecef;
    user-select: none;
    min-width: 80px;
    text-align: right;
}

.line-prefix {
    padding: 0 8px;
    font-weight: bold;
    min-width: 20px;
    text-align: center;
}

.line-content {
    padding: 0 8px;
    flex: 1;
    white-space: pre-wrap;
    word-break: break-all;
}

.diff-line.diff-context {
    background: white;
}

.diff-line.diff-insert {
    background: #d1ecf1;
    color: #0c5460;
}

.diff-line.diff-insert .line-prefix {
    background: #bee5eb;
    color: #0c5460;
}

.diff-line.diff-delete {
    background: #f8d7da;
    color: #721c24;
}

.diff-line.diff-delete .line-prefix {
    background: #f1b0b7;
    color: #721c24;
}

.diff-line.diff-modify {
    background: #fff3cd;
    color: #856404;
}

.diff-line.diff-modify .line-prefix {
    background: #ffeaa7;
    color: #856404;
}

/* Side-by-side Diff Styles */
.side-by-side-diff-view {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    overflow: hidden;
}

.diff-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: #e9ecef;
}

.diff-column {
    background: white;
}

.diff-column h4 {
    margin: 0;
    padding: 12px 16px;
    background: #495057;
    color: white;
    font-weight: 600;
    font-size: 14px;
    border-bottom: 1px solid #e9ecef;
}

.diff-column h4 i {
    margin-right: 8px;
    font-size: 12px;
}

.diff-content {
    max-height: 500px;
    overflow-y: auto;
    font-family: 'JetBrains Mono', 'Monaco', 'Consolas', monospace;
    font-size: 13px;
}

.diff-column .diff-line {
    display: flex;
    align-items: center;
    padding: 2px 0;
    border-bottom: 1px solid #f8f9fa;
    min-height: 20px;
}

.line-number {
    background: #f8f9fa;
    padding: 0 8px;
    color: #6c757d;
    font-size: 11px;
    border-right: 1px solid #e9ecef;
    user-select: none;
    min-width: 50px;
    text-align: right;
}

.diff-line .line-content {
    padding: 0 12px;
    flex: 1;
    white-space: pre-wrap;
    word-break: break-all;
}

.diff-line.diff-added {
    background: #d4edda;
    color: #155724;
    border-left: 3px solid #28a745;
}

.diff-line.diff-removed {
    background: #f8d7da;
    color: #721c24;
    border-left: 3px solid #dc3545;
}

.diff-line.diff-modified {
    background: #fff3cd;
    border-left: 3px solid #ffc107;
}

.word-delete {
    background: #f8d7da;
    color: #721c24;
    text-decoration: line-through;
    padding: 1px 3px;
    border-radius: 3px;
    margin: 0 1px;
    border: 1px solid #f5c6cb;
    position: relative;
}

.word-insert {
    background: #d4edda;
    color: #155724;
    font-weight: 500;
    padding: 1px 3px;
    border-radius: 3px;
    margin: 0 1px;
    border: 1px solid #c3e6cb;
    position: relative;
}

/* Error and Warning Messages */
.error {
    background: #f8d7da;
    color: #721c24;
    padding: 12px 16px;
    border-radius: 6px;
    border: 1px solid #f5c6cb;
    margin: 10px 0;
}

.warning {
    background: #fff3cd;
    color: #856404;
    padding: 12px 16px;
    border-radius: 6px;
    border: 1px solid #ffeaa7;
    margin: 10px 0;
}

/* Scrollbar Styling */
.unified-diff-content::-webkit-scrollbar,
.diff-content::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

.unified-diff-content::-webkit-scrollbar-track,
.diff-content::-webkit-scrollbar-track {
    background: #f1f1f1;
}

.unified-diff-content::-webkit-scrollbar-thumb,
.diff-content::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
}

.unified-diff-content::-webkit-scrollbar-thumb:hover,
.diff-content::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
}

/* Responsive Design */
@media (max-width: 768px) {
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .diff-columns {
        grid-template-columns: 1fr;
    }
    
    .unified-diff-content,
    .diff-content {
        max-height: 300px;
    }
}
`;

// Use centralized style management to prevent conflicts
if (window.StyleManager) {
    window.StyleManager.addToolStyles('text-compare', additionalStyles);
} else {
    // Fallback for backward compatibility
    const textCompareStyleElement = document.createElement('style');
    textCompareStyleElement.id = 'text-compare-styles';
    textCompareStyleElement.textContent = additionalStyles;
    document.head.appendChild(textCompareStyleElement);
}