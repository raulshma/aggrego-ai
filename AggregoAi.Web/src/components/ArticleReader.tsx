import { useState, useEffect, useRef, useCallback } from 'react';
import type { Article } from '../types/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  X, ExternalLink, Clock, 
  Brain, Search, Scale, Loader2, AlertCircle, CheckCircle,
  ArrowLeft, ArrowRight, TrendingUp, Globe, Flag,
  ChevronDown, ChevronRight, Wrench, Eye, Sparkles, RefreshCw
} from 'lucide-react';

interface ArticleReaderProps {
  article: Article;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

interface FactCheckResult {
  status: 'verified' | 'partially_verified' | 'unverified' | 'misleading';
  summary: string;
  claims: ClaimCheck[];
  sources: SourceReference[];
}

interface ClaimCheck {
  claim: string;
  verdict: 'true' | 'mostly_true' | 'mixed' | 'mostly_false' | 'false' | 'unverifiable';
  explanation: string;
  sources: string[];
}

interface SourceReference {
  title: string;
  url: string;
  relevance: string;
  publishedDate?: string;
}

interface BiasAnalysisResult {
  overallBias: 'far_left' | 'left' | 'center_left' | 'center' | 'center_right' | 'right' | 'far_right';
  confidence: number;
  indicators: BiasIndicator[];
  context: string;
  regionalContext?: string;
}

interface BiasIndicator {
  type: 'language' | 'framing' | 'source_selection' | 'omission' | 'emotional_appeal';
  description: string;
  severity: 'low' | 'medium' | 'high';
  leaning: 'left' | 'right' | 'neutral';
}


interface StreamStep {
  type: string;
  content: string;
  timestamp: Date;
  panel: 'factcheck' | 'bias';
}

const BIAS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  far_left: { bg: 'bg-blue-600', text: 'text-blue-100', label: 'Far Left' },
  left: { bg: 'bg-blue-500', text: 'text-blue-100', label: 'Left' },
  center_left: { bg: 'bg-blue-400', text: 'text-blue-900', label: 'Center-Left' },
  center: { bg: 'bg-gray-500', text: 'text-gray-100', label: 'Center' },
  center_right: { bg: 'bg-orange-400', text: 'text-orange-900', label: 'Center-Right' },
  right: { bg: 'bg-orange-500', text: 'text-orange-100', label: 'Right' },
  far_right: { bg: 'bg-orange-600', text: 'text-orange-100', label: 'Far Right' },
};

const VERDICT_COLORS: Record<string, { bg: string; text: string }> = {
  true: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  mostly_true: { bg: 'bg-emerald-400/20', text: 'text-emerald-300' },
  mixed: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  mostly_false: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  false: { bg: 'bg-red-500/20', text: 'text-red-400' },
  unverifiable: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
};

const getStepIcon = (type: string) => {
  switch (type) {
    case 'Thought': return <Brain className="w-3 h-3" />;
    case 'Action': return <Wrench className="w-3 h-3" />;
    case 'Observation': return <Eye className="w-3 h-3" />;
    default: return <Sparkles className="w-3 h-3" />;
  }
};

const getStepColor = (type: string) => {
  switch (type) {
    case 'Thought': return 'border-blue-500/30 bg-blue-500/5';
    case 'Action': return 'border-amber-500/30 bg-amber-500/5';
    case 'Observation': return 'border-emerald-500/30 bg-emerald-500/5';
    default: return 'border-border/50 bg-muted/50';
  }
};


export function ArticleReader({ 
  article, 
  onClose, 
  onPrevious, 
  onNext, 
  hasPrevious = false, 
  hasNext = false 
}: ArticleReaderProps) {
  const [factCheckSteps, setFactCheckSteps] = useState<StreamStep[]>([]);
  const [biasSteps, setBiasSteps] = useState<StreamStep[]>([]);
  const [factCheckLoading, setFactCheckLoading] = useState(false);
  const [biasLoading, setBiasLoading] = useState(false);
  const [factCheckResult, setFactCheckResult] = useState<FactCheckResult | null>(null);
  const [biasResult, setBiasResult] = useState<BiasAnalysisResult | null>(null);
  const [factCheckError, setFactCheckError] = useState<string | null>(null);
  const [biasError, setBiasError] = useState<string | null>(null);
  const [factCheckStepsExpanded, setFactCheckStepsExpanded] = useState(true);
  const [biasStepsExpanded, setBiasStepsExpanded] = useState(true);
  const [hasExistingAnalysis, setHasExistingAnalysis] = useState(false);
  const [analyzedAt, setAnalyzedAt] = useState<Date | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const factCheckScrollRef = useRef<HTMLDivElement>(null);
  const biasScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new steps arrive
  useEffect(() => {
    if (factCheckScrollRef.current && factCheckStepsExpanded) {
      factCheckScrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [factCheckSteps, factCheckStepsExpanded]);

  useEffect(() => {
    if (biasScrollRef.current && biasStepsExpanded) {
      biasScrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [biasSteps, biasStepsExpanded]);

  // Collapse steps when result arrives
  useEffect(() => {
    if (factCheckResult) {
      setFactCheckStepsExpanded(false);
    }
  }, [factCheckResult]);

  useEffect(() => {
    if (biasResult) {
      setBiasStepsExpanded(false);
    }
  }, [biasResult]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };


  const loadExistingAnalysis = useCallback(() => {
    if (!article?.analysisResult) return false;

    const { factCheckResult: fcResult, biasResult: bResult, analyzedAt: at } = article.analysisResult;
    
    if (fcResult) {
      try {
        setFactCheckResult(JSON.parse(fcResult));
      } catch {
        setFactCheckResult({ status: 'unverified', summary: fcResult, claims: [], sources: [] });
      }
    }
    
    if (bResult) {
      try {
        setBiasResult(JSON.parse(bResult));
      } catch {
        setBiasResult({ overallBias: 'center', confidence: 0, indicators: [], context: bResult });
      }
    }

    setAnalyzedAt(new Date(at));
    setHasExistingAnalysis(true);
    setFactCheckStepsExpanded(false);
    setBiasStepsExpanded(false);
    return true;
  }, [article]);

  const runAnalysis = useCallback(async () => {
    if (!article) return;

    setFactCheckSteps([]);
    setBiasSteps([]);
    setFactCheckError(null);
    setBiasError(null);
    setFactCheckResult(null);
    setBiasResult(null);
    setFactCheckLoading(true);
    setBiasLoading(true);
    setFactCheckStepsExpanded(true);
    setBiasStepsExpanded(true);
    setHasExistingAnalysis(false);
    setAnalyzedAt(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/article/${article.id}/analyze`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
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
              setFactCheckLoading(false);
              setBiasLoading(false);
              setHasExistingAnalysis(true);
              setAnalyzedAt(new Date());
              continue;
            }

            try {
              const event = JSON.parse(data);
              
              if (event.panel === 'factcheck') {
                if (event.type === 'error') {
                  setFactCheckError(event.content);
                  setFactCheckLoading(false);
                } else if (event.type === 'Result') {
                  try {
                    setFactCheckResult(JSON.parse(event.content));
                  } catch {
                    // If parsing fails, try to display as-is
                    setFactCheckResult({ status: 'unverified', summary: event.content, claims: [], sources: [] });
                  }
                  setFactCheckLoading(false);
                } else {
                  setFactCheckSteps(prev => [...prev, {
                    type: event.type,
                    content: event.content,
                    timestamp: new Date(event.timestamp),
                    panel: 'factcheck',
                  }]);
                }
              } else if (event.panel === 'bias') {
                if (event.type === 'error') {
                  setBiasError(event.content);
                  setBiasLoading(false);
                } else if (event.type === 'Result') {
                  try {
                    setBiasResult(JSON.parse(event.content));
                  } catch {
                    setBiasResult({ overallBias: 'center', confidence: 0, indicators: [], context: event.content });
                  }
                  setBiasLoading(false);
                } else {
                  setBiasSteps(prev => [...prev, {
                    type: event.type,
                    content: event.content,
                    timestamp: new Date(event.timestamp),
                    panel: 'bias',
                  }]);
                }
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setFactCheckError(err.message);
        setBiasError(err.message);
      }
    } finally {
      setFactCheckLoading(false);
      setBiasLoading(false);
    }
  }, [article]);

  useEffect(() => {
    // Try to load existing analysis first, otherwise run new analysis
    const hasExisting = loadExistingAnalysis();
    if (!hasExisting) {
      runAnalysis();
    }
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadExistingAnalysis, runAnalysis]);

  const handleClose = () => {
    abortControllerRef.current?.abort();
    onClose();
  };


  const renderBiasSpectrum = (bias: string) => {
    const positions = ['far_left', 'left', 'center_left', 'center', 'center_right', 'right', 'far_right'];
    const currentIndex = positions.indexOf(bias);
    
    return (
      <div className="relative mt-4">
        <div className="flex h-3 rounded-full overflow-hidden">
          {positions.map((pos, idx) => (
            <div 
              key={pos}
              className={`flex-1 ${idx <= 2 ? 'bg-blue-500' : idx === 3 ? 'bg-gray-500' : 'bg-orange-500'} 
                ${idx === 0 ? 'rounded-l-full' : ''} ${idx === 6 ? 'rounded-r-full' : ''}
                ${idx === currentIndex ? 'ring-2 ring-white ring-offset-2 ring-offset-background' : 'opacity-40'}`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Left</span>
          <span>Center</span>
          <span>Right</span>
        </div>
      </div>
    );
  };

  const renderStepsAccordion = (
    steps: StreamStep[], 
    isExpanded: boolean, 
    onToggle: () => void, 
    isLoading: boolean,
    scrollRef: React.RefObject<HTMLDivElement | null>
  ) => {
    if (steps.length === 0 && !isLoading) return null;

    return (
      <div className="border border-border/50 rounded-lg overflow-hidden">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Wrench className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Analysis Steps</span>
            <Badge variant="secondary" className="text-xs">{steps.length}</Badge>
          </div>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </button>
        
        {isExpanded && (
          <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
            {steps.map((step, idx) => (
              <div 
                key={idx} 
                className={`text-sm p-2.5 rounded-lg border ${getStepColor(step.type)} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${
                    step.type === 'Thought' ? 'text-blue-400' :
                    step.type === 'Action' ? 'text-amber-400' :
                    step.type === 'Observation' ? 'text-emerald-400' :
                    'text-muted-foreground'
                  }`}>
                    {getStepIcon(step.type)}
                    {step.type}
                  </span>
                </div>
                <p className="text-foreground/80 text-xs leading-relaxed">{step.content}</p>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Processing...</span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        )}
      </div>
    );
  };


  const renderFactCheckResult = () => {
    if (!factCheckResult) return null;

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Status Card */}
        <div className={`p-4 rounded-xl border ${
          factCheckResult.status === 'verified' ? 'bg-emerald-500/10 border-emerald-500/30' :
          factCheckResult.status === 'partially_verified' ? 'bg-amber-500/10 border-amber-500/30' :
          factCheckResult.status === 'misleading' ? 'bg-red-500/10 border-red-500/30' :
          'bg-gray-500/10 border-gray-500/30'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className={`w-5 h-5 ${
              factCheckResult.status === 'verified' ? 'text-emerald-400' :
              factCheckResult.status === 'partially_verified' ? 'text-amber-400' :
              factCheckResult.status === 'misleading' ? 'text-red-400' :
              'text-gray-400'
            }`} />
            <span className="font-semibold capitalize">{factCheckResult.status.replace('_', ' ')}</span>
          </div>
          <p className="text-sm text-muted-foreground">{factCheckResult.summary}</p>
        </div>

        {/* Claims */}
        {factCheckResult.claims && factCheckResult.claims.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Key Claims Analyzed
            </h4>
            {factCheckResult.claims.map((claim, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-card border border-border/50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium flex-1">"{claim.claim}"</p>
                  <Badge className={`${VERDICT_COLORS[claim.verdict]?.bg || 'bg-gray-500/20'} ${VERDICT_COLORS[claim.verdict]?.text || 'text-gray-400'} text-xs shrink-0`}>
                    {claim.verdict.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{claim.explanation}</p>
              </div>
            ))}
          </div>
        )}

        {/* Sources */}
        {factCheckResult.sources && factCheckResult.sources.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Sources Referenced
            </h4>
            {factCheckResult.sources.map((source, idx) => (
              <a 
                key={idx}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg bg-card border border-border/50 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <ExternalLink className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-primary hover:underline">{source.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{source.relevance}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  };


  const renderBiasResult = () => {
    if (!biasResult) return null;

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Overall Bias Card */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Bias</span>
            <Badge className={`${BIAS_COLORS[biasResult.overallBias]?.bg || 'bg-gray-500'} ${BIAS_COLORS[biasResult.overallBias]?.text || 'text-gray-100'}`}>
              {BIAS_COLORS[biasResult.overallBias]?.label || biasResult.overallBias}
            </Badge>
          </div>
          {renderBiasSpectrum(biasResult.overallBias)}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Confidence:</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${biasResult.confidence}%` }}
              />
            </div>
            <span className="text-xs font-medium">{biasResult.confidence}%</span>
          </div>
        </div>

        {/* Context */}
        {biasResult.context && (
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
            <p className="text-sm text-muted-foreground">{biasResult.context}</p>
          </div>
        )}

        {/* Regional Context */}
        {biasResult.regionalContext && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Flag className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">Regional Context</span>
            </div>
            <p className="text-sm text-muted-foreground">{biasResult.regionalContext}</p>
          </div>
        )}

        {/* Indicators */}
        {biasResult.indicators && biasResult.indicators.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Bias Indicators</h4>
            {biasResult.indicators.map((indicator, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-card border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-xs capitalize">
                    {indicator.type.replace('_', ' ')}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${
                      indicator.leaning === 'left' ? 'text-blue-400' :
                      indicator.leaning === 'right' ? 'text-orange-400' :
                      'text-gray-400'
                    }`}>
                      {indicator.leaning}
                    </span>
                    <Badge variant={
                      indicator.severity === 'high' ? 'destructive' :
                      indicator.severity === 'medium' ? 'secondary' : 'outline'
                    } className="text-xs">
                      {indicator.severity}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{indicator.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };


  const renderFactCheckPanel = () => (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border/50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <Search className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold">Fact Check</h3>
          <p className="text-xs text-muted-foreground">Cross-referenced with latest news</p>
        </div>
        {factCheckLoading && <Loader2 className="w-4 h-4 animate-spin text-primary ml-auto" />}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Initial loading state */}
          {factCheckLoading && factCheckSteps.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Starting analysis...</span>
              </div>
            </div>
          )}

          {/* Steps Accordion */}
          {(factCheckSteps.length > 0 || factCheckLoading) && (
            renderStepsAccordion(
              factCheckSteps, 
              factCheckStepsExpanded, 
              () => setFactCheckStepsExpanded(!factCheckStepsExpanded),
              factCheckLoading,
              factCheckScrollRef
            )
          )}

          {/* Result */}
          {renderFactCheckResult()}

          {/* Error */}
          {factCheckError && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{factCheckError}</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const renderBiasPanel = () => (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border/50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
          <Scale className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold">Bias Analysis</h3>
          <p className="text-xs text-muted-foreground">Political leaning & framing</p>
        </div>
        {biasLoading && <Loader2 className="w-4 h-4 animate-spin text-primary ml-auto" />}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Initial loading state */}
          {biasLoading && biasSteps.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Starting analysis...</span>
              </div>
            </div>
          )}

          {/* Steps Accordion */}
          {(biasSteps.length > 0 || biasLoading) && (
            renderStepsAccordion(
              biasSteps, 
              biasStepsExpanded, 
              () => setBiasStepsExpanded(!biasStepsExpanded),
              biasLoading,
              biasScrollRef
            )
          )}

          {/* Result */}
          {renderBiasResult()}

          {/* Error */}
          {biasError && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{biasError}</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );


  return (
    <TooltipProvider>
      <div className="fixed inset-0 z-50 bg-background">
        {/* Header */}
        <header className="h-14 border-b border-border/50 glass-strong flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleClose}>
                  <X className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close reader</TooltipContent>
            </Tooltip>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onPrevious} disabled={!hasPrevious}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Previous article</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onNext} disabled={!hasNext}>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Next article</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {analyzedAt && (
              <span className="text-xs text-muted-foreground">
                Analyzed {analyzedAt.toLocaleDateString()} {analyzedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={runAnalysis}
                  disabled={factCheckLoading || biasLoading}
                  className="gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${(factCheckLoading || biasLoading) ? 'animate-spin' : ''}`} />
                  {hasExistingAnalysis ? 'Refresh Analysis' : 'Run Analysis'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Run a fresh analysis</TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm" asChild>
              <a href={article.link} target="_blank" rel="noopener noreferrer" className="gap-2">
                <ExternalLink className="w-4 h-4" />
                Open Original
              </a>
            </Button>
          </div>
        </header>

        {/* Main Content - Three Column Layout */}
        <div className="h-[calc(100vh-3.5rem)] flex">
          {/* Left Panel - Fact Check */}
          <aside className="w-80 border-r border-border/50 bg-card/50 hidden lg:block">
            {renderFactCheckPanel()}
          </aside>

          {/* Center - Article Content */}
          <main className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <article className="max-w-3xl mx-auto px-6 py-8">
                {/* Article Header */}
                <header className="mb-8">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Badge variant="secondary">{article.sourceFeedName || 'Unknown Source'}</Badge>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(article.publicationDate)}
                    </span>
                  </div>
                  
                  <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                    {article.title}
                  </h1>

                  {article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {article.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </header>

                {/* Article Image */}
                {article.imageUrl && (
                  <figure className="mb-8 -mx-6 md:mx-0 md:rounded-xl overflow-hidden">
                    <img
                      src={article.imageUrl}
                      alt=""
                      className="w-full h-auto max-h-96 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </figure>
                )}

                {/* Article Description/Content */}
                <div className="prose prose-invert prose-lg max-w-none">
                  {article.description && (
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      {article.description}
                    </p>
                  )}
                  
                  <div className="mt-8 p-6 rounded-xl bg-muted/30 border border-border/50 text-center">
                    <p className="text-muted-foreground mb-4">
                      Read the full article on the original source
                    </p>
                    <Button asChild>
                      <a href={article.link} target="_blank" rel="noopener noreferrer" className="gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Continue Reading
                      </a>
                    </Button>
                  </div>
                </div>
              </article>
            </ScrollArea>
          </main>

          {/* Right Panel - Bias Analysis */}
          <aside className="w-80 border-l border-border/50 bg-card/50 hidden lg:block">
            {renderBiasPanel()}
          </aside>
        </div>

        {/* Mobile Panels - Tabs at bottom */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[50vh] bg-card border-t border-border">
          <div className="flex h-full">
            <div className="flex-1 border-r border-border/50 overflow-hidden">
              {renderFactCheckPanel()}
            </div>
            <div className="flex-1 overflow-hidden">
              {renderBiasPanel()}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
