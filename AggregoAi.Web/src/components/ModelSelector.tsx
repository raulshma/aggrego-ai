import { useState, useEffect, useMemo } from 'react';
import type { OpenRouterModel, GroupedModels } from '../types/openrouter';
import { fetchOpenRouterModels, groupModelsByPricing, formatPrice, formatContextLength } from '../services/openrouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, Search, Loader2, Sparkles, Coins, Cpu } from 'lucide-react';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  onContextLengthChange?: (contextLength: number) => void;
}

export function ModelSelector({ value, onChange, onContextLengthChange }: ModelSelectorProps) {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showFreeOnly, setShowFreeOnly] = useState(false);

  useEffect(() => {
    fetchOpenRouterModels()
      .then(setModels)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => groupModelsByPricing(models), [models]);

  const filteredGroups = useMemo((): GroupedModels => {
    const searchLower = search.toLowerCase();
    const filterFn = (m: OpenRouterModel) =>
      m.name.toLowerCase().includes(searchLower) || m.id.toLowerCase().includes(searchLower);

    return {
      free: grouped.free.filter(filterFn),
      paid: showFreeOnly ? [] : grouped.paid.filter(filterFn),
    };
  }, [grouped, search, showFreeOnly]);

  const selectedModel = models.find((m) => m.id === value);

  if (loading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-input text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading models...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-destructive">Failed to load models</div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter model ID manually"
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between h-auto py-2 px-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Cpu className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate text-left">
            {selectedModel ? selectedModel.name : value || 'Select a model'}
          </span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
      </Button>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 rounded-xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Search & Filter */}
          <div className="p-3 border-b border-border/50 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Free models only
              </label>
              <Switch
                checked={showFreeOnly}
                onCheckedChange={setShowFreeOnly}
              />
            </div>
          </div>

          {/* Model List */}
          <ScrollArea className="h-[300px]">
            <div className="p-2">
              {filteredGroups.free.length > 0 && (
                <ModelGroup
                  title="Free Models"
                  icon={<Sparkles className="w-4 h-4 text-success" />}
                  models={filteredGroups.free}
                  selectedId={value}
                  onSelect={(id, contextLength) => {
                    onChange(id);
                    onContextLengthChange?.(contextLength);
                    setIsOpen(false);
                  }}
                />
              )}
              {filteredGroups.paid.length > 0 && (
                <ModelGroup
                  title="Paid Models"
                  icon={<Coins className="w-4 h-4 text-warning" />}
                  models={filteredGroups.paid}
                  selectedId={value}
                  onSelect={(id, contextLength) => {
                    onChange(id);
                    onContextLengthChange?.(contextLength);
                    setIsOpen(false);
                  }}
                />
              )}
              {filteredGroups.free.length === 0 && filteredGroups.paid.length === 0 && (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  No models found
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

interface ModelGroupProps {
  title: string;
  icon: React.ReactNode;
  models: OpenRouterModel[];
  selectedId: string;
  onSelect: (id: string, contextLength: number) => void;
}

function ModelGroup({ title, icon, models, selectedId, onSelect }: ModelGroupProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {icon}
        {title} ({models.length})
      </div>
      <div className="space-y-1">
        {models.map((model) => (
          <button
            key={model.id}
            type="button"
            onClick={() => onSelect(model.id, model.context_length)}
            className={`w-full text-left p-3 rounded-lg transition-colors cursor-pointer ${
              model.id === selectedId 
                ? 'bg-primary/10 border border-primary/30' 
                : 'hover:bg-muted/50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{model.name}</div>
                <div className="text-xs text-muted-foreground truncate">{model.id}</div>
              </div>
              {model.id === selectedId && (
                <Badge variant="glow" className="shrink-0">Selected</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                {formatContextLength(model.context_length)} ctx
              </span>
              <span className="flex items-center gap-1">
                <Coins className="w-3 h-3" />
                {formatPrice(model.pricing.prompt)} / {formatPrice(model.pricing.completion)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
