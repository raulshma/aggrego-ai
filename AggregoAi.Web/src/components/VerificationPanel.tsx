import { useState, useEffect, useRef, useCallback } from 'react';
import type { Article, AgentStepEvent } from '../types/api';
import './VerificationPanel.css';

interface VerificationPanelProps {
  article: Article | null;
  onClose: () => void;
}

interface StreamStep {
  type: string;
  content: string;
  timestamp: Date;
}

export function VerificationPanel({ article, onClose }: VerificationPanelProps) {
  const [steps, setSteps] = useState<StreamStep[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const stepsEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [steps]);

  const startVerification = useCallback(async () => {
    if (!article) return;

    setSteps([]);
    setError(null);
    setIsComplete(false);
    setIsStreaming(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/article/${article.id}/verify`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Verification failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';


      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              setIsComplete(true);
              continue;
            }

            try {
              const event: AgentStepEvent = JSON.parse(data);
              
              if (event.type === 'error') {
                setError(event.content);
              } else {
                setSteps(prev => [...prev, {
                  type: event.type,
                  content: event.content,
                  timestamp: new Date(event.timestamp),
                }]);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsStreaming(false);
    }
  }, [article]);

  useEffect(() => {
    if (article) {
      startVerification();
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [article, startVerification]);

  const handleClose = () => {
    abortControllerRef.current?.abort();
    onClose();
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'Thought': return '💭';
      case 'Action': return '🔧';
      case 'Observation': return '👁️';
      case 'FinalAnswer': return '✅';
      default: return '•';
    }
  };

  const getStepClass = (type: string) => {
    return `step step-${type.toLowerCase()}`;
  };

  // Simple markdown rendering for basic formatting
  const renderMarkdown = (content: string) => {
    // Handle bold
    let html = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Handle italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Handle inline code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    // Handle links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    // Handle line breaks
    html = html.replace(/\n/g, '<br/>');
    
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  if (!article) return null;

  return (
    <div className="verification-panel-overlay" onClick={handleClose}>
      <div className="verification-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h3>AI Verification</h3>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        <div className="article-info">
          <h4>{article.title}</h4>
          <p className="source">{article.sourceFeedName}</p>
        </div>

        <div className="steps-container">
          {steps.length === 0 && isStreaming && (
            <div className="loading">Starting verification...</div>
          )}

          {steps.map((step, index) => (
            <div key={index} className={getStepClass(step.type)}>
              <div className="step-header">
                <span className="step-icon">{getStepIcon(step.type)}</span>
                <span className="step-type">{step.type}</span>
                <span className="step-time">
                  {step.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div className="step-content">
                {renderMarkdown(step.content)}
              </div>
            </div>
          ))}

          {error && (
            <div className="error-step">
              <span className="step-icon">❌</span>
              <span>{error}</span>
            </div>
          )}

          {isComplete && (
            <div className="complete-message">
              ✓ Verification complete
            </div>
          )}

          <div ref={stepsEndRef} />
        </div>

        <div className="panel-footer">
          {isStreaming ? (
            <button onClick={handleClose} className="cancel-btn">
              Cancel
            </button>
          ) : (
            <button onClick={handleClose} className="close-btn-footer">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
