import { useState, useEffect, useMemo } from 'react';
import type { OpenRouterModel, GroupedModels } from '../types/openrouter';
import { fetchOpenRouterModels, groupModelsByPricing, formatPrice, formatContextLength } from '../services/openrouter';
import './ModelSelector.css';

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
    return <div className="model-selector-loading">Loading models...</div>;
  }

  if (error) {
    return (
      <div className="model-selector-error">
        <span>Failed to load models</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter model ID manually"
        />
      </div>
    );
  }

  return (
    <div className="model-selector">
      <button
        type="button"
        className="model-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="selected-model">
          {selectedModel ? selectedModel.name : value || 'Select a model'}
        </span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="model-selector-dropdown">
          <div className="model-selector-controls">
            <input
              type="text"
              className="model-search"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <label className="free-only-toggle">
              <input
                type="checkbox"
                checked={showFreeOnly}
                onChange={(e) => setShowFreeOnly(e.target.checked)}
              />
              Free only
            </label>
          </div>

          <div className="model-list">
            {filteredGroups.free.length > 0 && (
              <ModelGroup
                title="Free Models"
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
              <div className="no-models">No models found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


interface ModelGroupProps {
  title: string;
  models: OpenRouterModel[];
  selectedId: string;
  onSelect: (id: string, contextLength: number) => void;
}

function ModelGroup({ title, models, selectedId, onSelect }: ModelGroupProps) {
  return (
    <div className="model-group">
      <div className="model-group-header">{title} ({models.length})</div>
      {models.map((model) => (
        <button
          key={model.id}
          type="button"
          className={`model-option ${model.id === selectedId ? 'selected' : ''}`}
          onClick={() => onSelect(model.id, model.context_length)}
        >
          <div className="model-option-main">
            <span className="model-name">{model.name}</span>
            <span className="model-id">{model.id}</span>
          </div>
          <div className="model-option-meta">
            <span className="model-context" title="Context length">
              {formatContextLength(model.context_length)} ctx
            </span>
            <span className="model-price" title="Price per 1M tokens">
              {formatPrice(model.pricing.prompt)} / {formatPrice(model.pricing.completion)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
