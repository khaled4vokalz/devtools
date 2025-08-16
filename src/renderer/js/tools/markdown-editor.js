class MarkdownEditor {
    constructor() {
        this.previewMode = 'split';
        this.isScrolling = false;
        this.editorScrollTimeout = null;
        this.previewScrollTimeout = null;
        this.init();
    }

    init() {
        const toolbarButtons = document.querySelectorAll('.toolbar-btn');
        const togglePreviewBtn = document.getElementById('toggle-preview');
        const markdownInput = document.getElementById('markdown-input');

        toolbarButtons.forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                this.handleToolbarAction(action);
            });
        });

        if (togglePreviewBtn) {
            togglePreviewBtn.addEventListener('click', () => this.togglePreview());
        }

        if (markdownInput) {
            markdownInput.addEventListener('input', () => this.updatePreview());
            markdownInput.addEventListener('scroll', () => this.throttledSyncFromEditor());
        }

        const previewContent = document.getElementById('preview-content');
        if (previewContent) {
            previewContent.addEventListener('scroll', () => this.throttledSyncFromPreview());
        }

        this.updatePreview();
    }

    handleToolbarAction(action) {
        const textarea = document.getElementById('markdown-input');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        let replacement = '';
        let newCursorPos = start;

        switch (action) {
            case 'bold':
                replacement = `**${selectedText || 'bold text'}**`;
                newCursorPos = start + (selectedText ? 2 : 2);
                break;
            case 'italic':
                replacement = `*${selectedText || 'italic text'}*`;
                newCursorPos = start + (selectedText ? 1 : 1);
                break;
            case 'strikethrough':
                replacement = `~~${selectedText || 'strikethrough text'}~~`;
                newCursorPos = start + (selectedText ? 2 : 2);
                break;
            case 'heading':
                replacement = `## ${selectedText || 'Heading'}`;
                newCursorPos = start + 3;
                break;
            case 'link':
                replacement = `[${selectedText || 'link text'}](https://example.com)`;
                newCursorPos = start + 1;
                break;
            case 'code':
                if (selectedText.includes('\n')) {
                    replacement = `\`\`\`\n${selectedText || 'code'}\n\`\`\``;
                    newCursorPos = start + 4;
                } else {
                    replacement = `\`${selectedText || 'code'}\``;
                    newCursorPos = start + 1;
                }
                break;
            case 'list':
                const lines = selectedText.split('\n');
                replacement = lines.map(line => `- ${line}`).join('\n') || '- List item';
                newCursorPos = start + 2;
                break;
        }

        textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        
        this.updatePreview();
    }

    togglePreview() {
        const input = document.querySelector('.markdown-input');
        const preview = document.querySelector('.markdown-preview');
        const button = document.getElementById('toggle-preview');

        switch (this.previewMode) {
            case 'split':
                this.previewMode = 'preview';
                input.style.display = 'none';
                preview.style.width = '100%';
                button.textContent = 'Show Editor';
                break;
            case 'preview':
                this.previewMode = 'editor';
                preview.style.display = 'none';
                input.style.width = '100%';
                button.textContent = 'Show Preview';
                break;
            case 'editor':
                this.previewMode = 'split';
                input.style.display = 'flex';
                input.style.width = '50%';
                preview.style.display = 'block';
                preview.style.width = '50%';
                button.textContent = 'Toggle Preview';
                break;
        }
    }

    updatePreview() {
        const input = document.getElementById('markdown-input').value;
        const preview = document.getElementById('preview-content');
        
        if (input.trim() === '') {
            preview.innerHTML = '<p class="empty-preview">Preview will appear here...</p>';
            return;
        }

        const html = this.markdownToHtml(input);
        preview.innerHTML = html;
        
        // Debug: Log the HTML for the Converters section
        if (input.includes('### Converters')) {
            console.log('HTML output for debugging:', html);
        }
        
        // Reset scroll sync flag after content update
        if (this.isScrolling) {
            setTimeout(() => {
                this.isScrolling = false;
            }, 50);
        }
    }

    markdownToHtml(markdown) {
        let html = markdown;

        // First, protect code blocks from other transformations
        const codeBlocks = [];
        html = html.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, lang, code) => {
            const index = codeBlocks.length;
            codeBlocks.push(`<pre><code class="language-${lang || 'text'}">${this.escapeHtml(code)}</code></pre>`);
            return `__CODEBLOCK_${index}__`;
        });

        // Protect inline code from other transformations
        const inlineCode = [];
        html = html.replace(/`([^`]+)`/g, (match, code) => {
            const index = inlineCode.length;
            inlineCode.push(`<code>${this.escapeHtml(code)}</code>`);
            return `__INLINECODE_${index}__`;
        });

        // Process by lines to handle block elements correctly
        const lines = html.split('\n');
        const processedLines = [];
        let inList = false;
        let listType = null; // 'ul' or 'ol'
        let inBlockquote = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Handle horizontal rules
            if (line.trim() === '---') {
                if (inList) {
                    processedLines.push(`</${listType}>`);
                    inList = false;
                    listType = null;
                }
                if (inBlockquote) {
                    processedLines.push('</blockquote>');
                    inBlockquote = false;
                }
                processedLines.push('<hr>');
                continue;
            }

            // Handle headings (must come before other processing)
            if (line.match(/^#{1,6} /)) {
                if (inList) {
                    processedLines.push(`</${listType}>`);
                    inList = false;
                    listType = null;
                }
                if (inBlockquote) {
                    processedLines.push('</blockquote>');
                    inBlockquote = false;
                }
                line = line.replace(/^(#{1,6}) (.*)$/, (match, hashes, text) => {
                    const level = hashes.length;
                    return `<h${level}>${text}</h${level}>`;
                });
                processedLines.push(line);
                continue;
            }

            // Handle blockquotes
            if (line.match(/^> /)) {
                if (inList) {
                    processedLines.push(`</${listType}>`);
                    inList = false;
                    listType = null;
                }
                if (!inBlockquote) {
                    processedLines.push('<blockquote>');
                    inBlockquote = true;
                }
                line = line.replace(/^> (.*)$/, '$1');
                processedLines.push(line);
                continue;
            } else if (inBlockquote) {
                processedLines.push('</blockquote>');
                inBlockquote = false;
            }

            // Handle unordered lists (including task lists)
            if (line.match(/^- /) || line.match(/^- \[[ x]\] /)) {
                if (!inList || listType !== 'ul') {
                    if (inList) {
                        processedLines.push(`</${listType}>`);
                    }
                    processedLines.push('<ul>');
                    inList = true;
                    listType = 'ul';
                }
                // Handle task lists
                if (line.match(/^- \[[ x]\] /)) {
                    line = line.replace(/^- \[( )\] (.*)$/, '<li class="task-list-item"><input type="checkbox" disabled> $2</li>');
                    line = line.replace(/^- \[x\] (.*)$/, '<li class="task-list-item"><input type="checkbox" checked disabled> $1</li>');
                } else {
                    // Handle regular list items, ensuring proper encoding of special characters
                    line = line.replace(/^- (.*)$/, (match, content) => {
                        // Ensure Unicode characters are properly handled
                        return `<li>${content}</li>`;
                    });
                }
                processedLines.push(line);
                continue;
            }

            // Handle ordered lists
            if (line.match(/^\d+\. /)) {
                if (!inList || listType !== 'ol') {
                    if (inList) {
                        processedLines.push(`</${listType}>`);
                    }
                    processedLines.push('<ol>');
                    inList = true;
                    listType = 'ol';
                }
                line = line.replace(/^\d+\. (.*)$/, '<li>$1</li>');
                processedLines.push(line);
                continue;
            }

            // If we were in a list but this line isn't a list item, close the list
            if (inList && line.trim() !== '') {
                processedLines.push(`</${listType}>`);
                inList = false;
                listType = null;
            }

            processedLines.push(line);
        }

        // Close any open lists or blockquotes at the end
        if (inList) {
            processedLines.push(`</${listType}>`);
        }
        if (inBlockquote) {
            processedLines.push('</blockquote>');
        }

        html = processedLines.join('\n');

        // Handle tables (basic support)
        html = html.replace(/\n\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.*\|\n?)*)/g, (match, header, rows) => {
            const headerCells = header.split('|').map(cell => `<th>${cell.trim()}</th>`).join('');
            const bodyRows = rows.trim().split('\n').map(row => {
                const cells = row.split('|').slice(1, -1).map(cell => `<td>${cell.trim()}</td>`).join('');
                return `<tr>${cells}</tr>`;
            }).join('');
            return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
        });

        // Handle inline formatting (after block elements are processed)
        // Images (must come before links)
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" style="max-width: 100%; height: auto;">');
        
        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // Strikethrough (GitHub-flavored markdown)
        html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

        // Bold (must come before italic to handle ***bold italic***)
        html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Handle paragraphs (split by double newlines, but preserve block elements)
        // First normalize line endings and clean up extra whitespace
        html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Fix any broken lists that got split incorrectly
        html = html.replace(/(<\/ul>)\s*\n\s*(<ul>)/g, '\n');
        html = html.replace(/(<\/ol>)\s*\n\s*(<ol>)/g, '\n');
        
        // Clean up any extra spacing around list items
        html = html.replace(/(<li>[^<]*<\/li>)\s*\n\s*(<li>)/g, '$1\n$2');
        
        const paragraphs = html.split(/\n\s*\n/);
        html = paragraphs.map((paragraph, index) => {
            paragraph = paragraph.trim();
            
            // Skip empty paragraphs
            if (!paragraph) return '';
            
            // Don't process block elements
            if (paragraph.match(/^<(h[1-6]|ul|ol|li|blockquote|pre|hr|div|table)/)) {
                return paragraph;
            }
            
            const lines = paragraph.split('\n').filter(line => line.trim());
            
            // Don't wrap single block elements in paragraphs
            if (lines.length === 1 && lines[0].match(/^<(h[1-6]|hr|table|ul|ol)/)) {
                return paragraph;
            }
            
            // Check if this is actually list content that got separated
            if (lines.every(line => line.match(/^<li>/) || line.trim() === '' || line.match(/^<\/?(ul|ol)>/))) {
                return paragraph; // Don't wrap list items in paragraphs
            }
            
            // Handle line breaks within paragraphs
            paragraph = paragraph.replace(/\n/g, '<br>');
            return `<p>${paragraph}</p>`;
        }).filter(p => p.trim()).join('\n');

        // Restore code blocks
        codeBlocks.forEach((block, index) => {
            html = html.replace(`__CODEBLOCK_${index}__`, block);
        });

        // Restore inline code
        inlineCode.forEach((code, index) => {
            html = html.replace(`__INLINECODE_${index}__`, code);
        });

        // Final cleanup: ensure proper list structure
        html = this.cleanupListStructure(html);

        return html;
    }

    cleanupListStructure(html) {
        // Remove any paragraph tags that might have been added around list items
        html = html.replace(/<p>(<li>.*?<\/li>)<\/p>/g, '$1');
        
        // Remove empty paragraphs
        html = html.replace(/<p>\s*<\/p>/g, '');
        
        // Ensure consecutive list items are properly grouped
        html = html.replace(/(<\/li>)\s*<p>\s*(<li>)/g, '$1\n$2');
        
        // Clean up any extra spacing in lists
        html = html.replace(/(<ul[^>]*>)\s*<p>\s*/g, '$1\n');
        html = html.replace(/\s*<\/p>\s*(<\/ul>)/g, '\n$1');
        html = html.replace(/(<ol[^>]*>)\s*<p>\s*/g, '$1\n');
        html = html.replace(/\s*<\/p>\s*(<\/ol>)/g, '\n$1');
        
        return html;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    throttledSyncFromEditor() {
        if (this.editorScrollTimeout) {
            clearTimeout(this.editorScrollTimeout);
        }
        this.editorScrollTimeout = setTimeout(() => this.syncScrollFromEditor(), 16); // ~60fps
    }

    throttledSyncFromPreview() {
        if (this.previewScrollTimeout) {
            clearTimeout(this.previewScrollTimeout);
        }
        this.previewScrollTimeout = setTimeout(() => this.syncScrollFromPreview(), 16); // ~60fps
    }

    syncScrollFromEditor() {
        const input = document.getElementById('markdown-input');
        const preview = document.getElementById('preview-content');
        
        if (!input || !preview || this.previewMode !== 'split' || this.isScrolling) {
            return;
        }

        // Calculate scroll percentage with better precision
        const inputScrollHeight = Math.max(input.scrollHeight - input.clientHeight, 1);
        const previewScrollHeight = Math.max(preview.scrollHeight - preview.clientHeight, 1);
        
        if (inputScrollHeight <= 1 || previewScrollHeight <= 1) {
            return;
        }

        const percentage = Math.min(Math.max(input.scrollTop / inputScrollHeight, 0), 1);
        const targetScrollTop = Math.round(percentage * previewScrollHeight);
        
        // Set flag to prevent scroll event loops
        this.isScrolling = true;
        preview.scrollTop = targetScrollTop;
        
        // Clear flag after a short delay
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.isScrolling = false;
            });
        });
    }

    syncScrollFromPreview() {
        const input = document.getElementById('markdown-input');
        const preview = document.getElementById('preview-content');
        
        if (!input || !preview || this.previewMode !== 'split' || this.isScrolling) {
            return;
        }

        // Calculate scroll percentage with better precision
        const previewScrollHeight = Math.max(preview.scrollHeight - preview.clientHeight, 1);
        const inputScrollHeight = Math.max(input.scrollHeight - input.clientHeight, 1);
        
        if (previewScrollHeight <= 1 || inputScrollHeight <= 1) {
            return;
        }

        const percentage = Math.min(Math.max(preview.scrollTop / previewScrollHeight, 0), 1);
        const targetScrollTop = Math.round(percentage * inputScrollHeight);
        
        // Set flag to prevent scroll event loops
        this.isScrolling = true;
        input.scrollTop = targetScrollTop;
        
        // Clear flag after a short delay
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.isScrolling = false;
            });
        });
    }

    exportMarkdown() {
        const content = document.getElementById('markdown-input').value;
        if (content.trim()) {
            const blob = new Blob([content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'document.md';
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    exportHTML() {
        const markdown = document.getElementById('markdown-input').value;
        if (markdown.trim()) {
            const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Exported Document</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-family: 'Monaco', 'Consolas', monospace; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
        blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }
    </style>
</head>
<body>
${this.markdownToHtml(markdown)}
</body>
</html>`;
            
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'document.html';
            a.click();
            URL.revokeObjectURL(url);
        }
    }
}

window.MarkdownEditor = new MarkdownEditor();

const markdownStyles = `
.markdown-toolbar {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 8px 8px 0 0;
    border-bottom: 1px solid #e0e0e0;
    flex-wrap: wrap;
}

.toolbar-btn {
    background: none;
    border: 1px solid #d0d0d0;
    border-radius: 4px;
    padding: 8px 10px;
    cursor: pointer;
    color: #666;
    font-size: 14px;
    transition: all 0.3s ease;
}

.toolbar-btn:hover {
    background: #667eea;
    color: white;
    border-color: #667eea;
}

.toolbar-divider {
    width: 1px;
    height: 20px;
    background: #d0d0d0;
    margin: 0 10px;
}

.markdown-container {
    display: flex;
    border: 2px solid #f0f0f0;
    border-radius: 0 0 8px 8px;
    min-height: 400px;
}

.markdown-input,
.markdown-preview {
    flex: 1;
    overflow: auto;
}

.markdown-input {
    display: flex;
    flex-direction: column;
    border-right: 1px solid #e0e0e0;
}

#markdown-input {
    width: 100%;
    height: 400px;
    border: none;
    outline: none;
    padding: 20px;
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 14px;
    line-height: 1.5;
    resize: none;
    background: #fafafa;
}

.markdown-preview {
    background: white;
}

#preview-content {
    padding: 20px;
    height: 400px;
    overflow-y: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
}

#preview-content h1,
#preview-content h2,
#preview-content h3,
#preview-content h4,
#preview-content h5,
#preview-content h6 {
    color: #1d1d1f;
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
}

#preview-content h1:first-child,
#preview-content h2:first-child,
#preview-content h3:first-child {
    margin-top: 0;
}

#preview-content h1 { 
    font-size: 2rem; 
    border-bottom: 1px solid #e0e0e0; 
    padding-bottom: 10px; 
}
#preview-content h2 { 
    font-size: 1.5rem; 
    border-bottom: 1px solid #f0f0f0; 
    padding-bottom: 8px; 
}
#preview-content h3 { font-size: 1.25rem; }
#preview-content h4 { font-size: 1.1rem; }
#preview-content h5 { font-size: 1rem; }
#preview-content h6 { font-size: 0.9rem; color: #666; }

#preview-content p {
    margin-bottom: 12px;
    color: #333;
}

#preview-content code {
    background: #f4f4f4;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 13px;
}

#preview-content pre {
    background: #f8f9fa;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 16px 0;
    border: 1px solid #e0e0e0;
}

#preview-content pre code {
    background: none;
    padding: 0;
}

#preview-content blockquote {
    border-left: 4px solid #d0d7de;
    margin: 16px 0;
    padding: 8px 16px;
    color: #656d76;
    background: #f6f8fa;
    border-radius: 0 6px 6px 0;
}

#preview-content blockquote p {
    margin: 0;
}

#preview-content blockquote > :first-child {
    margin-top: 0;
}

#preview-content blockquote > :last-child {
    margin-bottom: 0;
}

#preview-content ul,
#preview-content ol {
    padding-left: 25px !important;
    margin: 8px 0 !important;
    list-style-position: outside !important;
    line-height: 1.4 !important;
}

#preview-content ul ul,
#preview-content ol ol,
#preview-content ul ol,
#preview-content ol ul {
    margin: 0 !important;
}

#preview-content li {
    margin: 0 !important;
    padding: 0 !important;
    line-height: 1.4 !important;
    display: list-item !important;
}

#preview-content li p {
    margin: 0 !important;
    padding: 0 !important;
    display: inline !important;
}

#preview-content ul {
    list-style-type: disc !important;
}

#preview-content ol {
    list-style-type: decimal !important;
}

#preview-content li > p {
    margin: 0;
}

#preview-content .task-list-item {
    list-style: none;
    position: relative;
    margin-left: -20px;
}

#preview-content .task-list-item input[type="checkbox"] {
    margin-right: 8px;
    position: relative;
    top: 1px;
}

#preview-content ul {
    list-style-type: disc !important;
}

#preview-content ol {
    list-style-type: decimal !important;
}

#preview-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    overflow: hidden;
}

#preview-content th,
#preview-content td {
    padding: 8px 12px;
    text-align: left;
    border: 1px solid #d0d7de;
}

#preview-content th {
    background: #f6f8fa;
    font-weight: 600;
    color: #24292f;
}

#preview-content tr:nth-child(even) {
    background: #f6f8fa;
}

#preview-content a {
    color: #667eea;
    text-decoration: none;
}

#preview-content a:hover {
    text-decoration: underline;
}

#preview-content del {
    color: #666;
    text-decoration: line-through;
}

#preview-content strong {
    font-weight: 600;
}

#preview-content em {
    font-style: italic;
}

#preview-content hr {
    border: none;
    height: 1px;
    background: #e0e0e0;
    margin: 24px 0;
}

.empty-preview {
    color: #86868b;
    font-style: italic;
    text-align: center;
    margin-top: 50px;
}

@media (max-width: 768px) {
    .markdown-container {
        flex-direction: column;
    }
    
    .markdown-input {
        border-right: none;
        border-bottom: 1px solid #e0e0e0;
    }
    
    #markdown-input,
    #preview-content {
        height: 300px;
    }
}
`;

// Use centralized style management to prevent conflicts
if (window.StyleManager) {
    window.StyleManager.addToolStyles('markdown-editor', markdownStyles);
} else {
    // Fallback for backward compatibility
    const markdownEditorStyleElement = document.createElement('style');
    markdownEditorStyleElement.id = 'markdown-editor-styles';
    markdownEditorStyleElement.textContent = markdownStyles;
    document.head.appendChild(markdownEditorStyleElement);
}