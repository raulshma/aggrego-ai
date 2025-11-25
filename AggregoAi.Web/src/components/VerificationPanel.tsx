import { useState, useEffect, useRef, useCallback } from 'react';
import type { Article, AgentStepEvent } from '../types/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { X, Brain, Wrench, Eye, CheckCircle, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

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
      case 'Thought': return <Brain className="w-4 h-4" />;
      case 'Action': return <Wrench className="w-4 h-4" />;
      case 'Observation': return <Eye className="w-4 h-4" />;
      case 'FinalAnswer': return <CheckCircle className="w-4 h-4" />;
      default: return <div className="w-4 h-4 rounded-full bg-current" />;
    }
  };

  const getStepColor = (type: string) => {
    switch (type) {
      case 'Thought': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      case 'Action': return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
      case 'Observation': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
      case 'FinalAnswer': return 'text-primary bg-primary/10 border-primary/30';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const renderMarkdown = (content: string) => {
    let html = content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>');
    html = html.replace(/\n/g, '<br/>');
    
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  if (!article) return null;

  return (
    <TooltipProvider>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Panel */}
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">AI Verification</h3>
              <p className="text-xs text-muted-foreground">Analyzing article credibility</p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close panel</TooltipContent>
          </Tooltip>
        </div>

        {/* Article Info */}
        <div className="p-4 border-b border-border/50 bg-muted/30">
          <h4 className="font-medium line-clamp-2 mb-1">{article.title}</h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{article.sourceFeedName}</span>
            <a 
              href={article.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              View Article
            </a>
          </div>
        </div>

        {/* Steps */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {steps.length === 0 && isStreaming && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Starting verification...</span>
                </div>
              </div>
            )}

            {steps.map((step, index) => (
              <div 
                key={index} 
                className={`rounded-xl border p-4 ${getStepColor(step.type)}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getStepIcon(step.type)}
                  <Badge variant="outline" className="text-xs border-current/30">
                    {step.type}
                  </Badge>
                  <span className="text-xs opacity-60 ml-auto">
                    {step.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm leading-relaxed">
                  {renderMarkdown(step.content)}
                </div>
              </div>
            ))}

            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {isComplete && (
              <div className="flex items-center justify-center gap-2 py-4 text-success">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Verification complete</span>
              </div>
            )}

            <div ref={stepsEndRef} />
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 bg-muted/30">
          <Button 
            onClick={handleClose} 
            variant={isStreaming ? 'destructive' : 'outline'}
            className="w-full"
          >
            {isStreaming ? 'Cancel Verification' : 'Close'}
          </Button>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
