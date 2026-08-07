// src/components/CodeEditor.jsx

import React, { useEffect } from 'react';
import { useSyntaxHighlight } from '../hooks/useSyntaxHighlight';
import { syntaxHighlighter } from '../services/syntax-highlighter';

export function CodeEditor({ initialCode, language, onChange }) {
    const {
        code,
        setCode,
        language: currentLanguage,
        setLanguage,
        highlighted,
        isLoading,
        error
    } = useSyntaxHighlight(initialCode, language);

    const handleCodeChange = (e) => {
        const newCode = e.target.value;
        setCode(newCode);
        if (onChange) {
            onChange(newCode);
        }
    };

    const handleLanguageChange = (e) => {
        setLanguage(e.target.value);
    };

    // Отображение статистики кэша (для отладки)
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            const stats = syntaxHighlighter.getCacheStats();
            console.log('Кэш подсветки:', stats);
        }
    }, []);

    return (
        <div className="code-editor">
            <div className="code-editor-controls">
                <select 
                    value={currentLanguage || 'auto'} 
                    onChange={handleLanguageChange}
                >
                    <option value="auto">Автоопределение</option>
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="csharp">C#</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="sql">SQL</option>
                    <option value="go">Go</option>
                    <option value="rust">Rust</option>
                    <option value="php">PHP</option>
                    <option value="bash">Bash</option>
                    <option value="text">Текст</option>
                </select>
                {isLoading && <span className="loading-indicator">⏳ Подсветка...</span>}
                {error && <span className="error-indicator">❌ Ошибка: {error}</span>}
            </div>
            
            <div className="code-editor-container">
                <textarea
                    className="code-input"
                    value={code}
                    onChange={handleCodeChange}
                    spellCheck={false}
                    placeholder="Введите код..."
                />
                <div 
                    className="code-output"
                    dangerouslySetInnerHTML={{ __html: highlighted }}
                />
            </div>
        </div>
    );
}