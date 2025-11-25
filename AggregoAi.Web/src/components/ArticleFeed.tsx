import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { articleApi } from '../services/api';
import type { Article, ConfidenceLevel } from '../types/api';
import { VerificationStatus, ConfidenceLevel as ConfidenceLevelValues } from '../types/api';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import { 
  RefreshCw, ExternalLink, Shield, ShieldCheck, ShieldAlert, Clock, Loader2, 
  Trash2, EyeOff, Eye, CheckSquare, Square, BookOpen, ChevronLeft, ChevronRight,
  TrendingUp
} from 'lucide-react';
import { ArticleReader } from './ArticleReader';

export function ArticleFeed() {
  const { isAuthenticated } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [readerArticle, setReaderArticle] = useState<Article | null>(null);
  const [readerIndex, setReaderIndex] = useState<number>(-1);
  const limit = 50;

  const loadArticles = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setArticles([]);
    } else {
      setLoadingMore(true);
    }

    try {
      setError(null);
      const currentOffset = reset ? 0 : articles.length;
      const response = await articleApi.getArticles(limit, currentOffset);
      
      if (reset) {
        setArticles(response.articles);
      } else {
        setArticles(prev => [...prev, ...response.articles]);
      }
      
      setHasMore(response.articles.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [articles.length]);

  useEffect(() => {
    loadArticles(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      loadArticles(false);
    }
  }, [loading, loadingMore, hasMore, loadArticles]);

  const refresh = () => {
    setSelectedIds(new Set());
    loadArticles(true);
  };

  const toggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = () => {
    if (selectedIds.size === articles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(articles.map(a => a.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} article(s)?`)) return;

    setActionLoading(true);
    try {
      await articleApi.bulkDeleteArticles(Array.from(selectedIds));
      setSelectedIds(new Set());
      await loadArticles(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete articles');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkHide = async (hide: boolean) => {
    if (selectedIds.size === 0) return;

    setActionLoading(true);
    try {
      await articleApi.bulkSetArticlesHidden(Array.from(selectedIds), hide);
      setSelectedIds(new Set());
      await loadArticles(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update articles');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSingleDelete = useCallback(async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Delete this article?')) return;

    setActionLoading(true);
    try {
      await articleApi.deleteArticle(id);
      await loadArticles(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete article');
    } finally {
      setActionLoading(false);
    }
  }, [loadArticles]);

  const handleToggleHidden = useCallback(async (article: Article, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActionLoading(true);
    try {
      await articleApi.setArticleHidden(article.id, !article.isHidden);
      await loadArticles(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update article');
    } finally {
      setActionLoading(false);
    }
  }, [loadArticles]);

  const openReader = useCallback((article: Article, index: number) => {
    setReaderArticle(article);
    setReaderIndex(index);
  }, []);

  const closeReader = () => {
    setReaderArticle(null);
    setReaderIndex(-1);
  };

  const navigateReader = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? readerIndex - 1 : readerIndex + 1;
    if (newIndex >= 0 && newIndex < articles.length) {
      setReaderArticle(articles[newIndex]);
      setReaderIndex(newIndex);
    }
  };

  const getConfidenceLabel = (confidence: ConfidenceLevel | undefined): string => {
    switch (confidence) {
      case ConfidenceLevelValues.High: return 'High';
      case ConfidenceLevelValues.Medium: return 'Medium';
      case ConfidenceLevelValues.Low: return 'Low';
      default: return 'Medium';
    }
  };

  const getStatusBadge = useCallback((article: Article, compact = false) => {
    switch (article.verificationStatus) {
      case VerificationStatus.Verified: {
        const confidence = article.verdict?.confidence;
        const variant = confidence === ConfidenceLevelValues.High ? 'success' 
          : confidence === ConfidenceLevelValues.Medium ? 'warning' : 'destructive';
        return (
          <Badge variant={variant} className={`gap-1 ${compact ? 'text-[10px] px-1.5 py-0' : ''}`}>
            <ShieldCheck className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            {compact ? getConfidenceLabel(confidence) : `Verified (${getConfidenceLabel(confidence)})`}
          </Badge>
        );
      }
      case VerificationStatus.InProgress:
        return (
          <Badge variant="secondary" className={`gap-1 ${compact ? 'text-[10px] px-1.5 py-0' : ''}`}>
            <Loader2 className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} animate-spin`} />
            {compact ? '...' : 'Verifying'}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className={`gap-1 ${compact ? 'text-[10px] px-1.5 py-0' : ''}`}>
            <ShieldAlert className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            {compact ? 'New' : 'Unverified'}
          </Badge>
        );
    }
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Group articles by source feed
  const groupedArticles = useMemo(() => {
    const groups: Record<string, Article[]> = {};
    articles.forEach(article => {
      const source = article.sourceFeedName || 'Other';
      if (!groups[source]) groups[source] = [];
      groups[source].push(article);
    });
    return groups;
  }, [articles]);

  // Get featured article (first with image)
  const featuredArticle = useMemo(() => 
    articles.find(a => a.imageUrl && !a.isHidden), [articles]);

  // Get recent articles (excluding featured)
  const recentArticles = useMemo(() => 
    articles.filter(a => a.id !== featuredArticle?.id).slice(0, 10), [articles, featuredArticle]);

  // Get editor picks (articles with analysis or high confidence)
  const editorPicks = useMemo(() => 
    articles.filter(a => 
      a.id !== featuredArticle?.id && 
      (a.analysisResult || a.verdict?.confidence === ConfidenceLevelValues.High)
    ).slice(0, 5), [articles, featuredArticle]);

  if (error && articles.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">News Feed</h2>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="p-6 text-center text-destructive">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (loading && articles.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading articles...</p>
        </CardContent>
      </Card>
    );
  }

  if (articles.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-2">No articles yet</h3>
          <p className="text-muted-foreground text-sm">Check back soon for the latest news.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="feed-container space-y-8">
        {/* Admin Controls */}
        {isAuthenticated && (
          <div className="flex items-center justify-between glass rounded-lg px-4 py-2">
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <Badge variant="secondary">{selectedIds.size} selected</Badge>
                  <Button onClick={() => handleBulkHide(true)} variant="ghost" size="sm" disabled={actionLoading}>
                    <EyeOff className="w-4 h-4" />
                  </Button>
                  <Button onClick={() => handleBulkHide(false)} variant="ghost" size="sm" disabled={actionLoading}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button onClick={handleBulkDelete} variant="ghost" size="sm" disabled={actionLoading} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button onClick={selectAll} variant="ghost" size="sm">
                {selectedIds.size === articles.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </Button>
            </div>
            <Button onClick={refresh} variant="ghost" size="sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        )}

        {/* Hero Section */}
        {featuredArticle && (
          <HeroArticle 
            article={featuredArticle} 
            index={articles.indexOf(featuredArticle)}
            onOpen={openReader}
            isAuthenticated={isAuthenticated}
            isSelected={selectedIds.has(featuredArticle.id)}
            onToggleSelect={toggleSelect}
            onDelete={handleSingleDelete}
            onToggleHidden={handleToggleHidden}
            actionLoading={actionLoading}
          />
        )}

        {/* Recent News - Horizontal Scroll */}
        <FeedSection title="Recent News" icon={<Clock className="w-5 h-5" />}>
          <HorizontalScroll>
            {recentArticles.map((article) => (
              <SmallArticleCard
                key={article.id}
                article={article}
                index={articles.indexOf(article)}
                onOpen={openReader}
                formatDate={formatDate}
                getStatusBadge={getStatusBadge}
                isAuthenticated={isAuthenticated}
                isSelected={selectedIds.has(article.id)}
                onToggleSelect={toggleSelect}
                onDelete={handleSingleDelete}
                onToggleHidden={handleToggleHidden}
                actionLoading={actionLoading}
              />
            ))}
          </HorizontalScroll>
        </FeedSection>

        {/* Editor Picks - Featured Layout */}
        {editorPicks.length > 0 && (
          <FeedSection title="Editor's Picks" icon={<TrendingUp className="w-5 h-5" />}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {editorPicks[0] && (
                <div className="lg:col-span-2">
                  <LargeArticleCard
                    article={editorPicks[0]}
                    index={articles.indexOf(editorPicks[0])}
                    onOpen={openReader}
                    formatDate={formatDate}
                    getStatusBadge={getStatusBadge}
                    isAuthenticated={isAuthenticated}
                    isSelected={selectedIds.has(editorPicks[0].id)}
                    onToggleSelect={toggleSelect}
                    onDelete={handleSingleDelete}
                    onToggleHidden={handleToggleHidden}
                    actionLoading={actionLoading}
                  />
                </div>
              )}
              <div className="space-y-4">
                {editorPicks.slice(1, 4).map(article => (
                  <CompactArticleCard
                    key={article.id}
                    article={article}
                    index={articles.indexOf(article)}
                    onOpen={openReader}
                    formatDate={formatDate}
                    getStatusBadge={getStatusBadge}
                    isAuthenticated={isAuthenticated}
                    isSelected={selectedIds.has(article.id)}
                    onToggleSelect={toggleSelect}
                    onDelete={handleSingleDelete}
                    onToggleHidden={handleToggleHidden}
                    actionLoading={actionLoading}
                  />
                ))}
              </div>
            </div>
          </FeedSection>
        )}

        {/* Source-based Sections */}
        {Object.entries(groupedArticles).map(([source, sourceArticles]) => (
          <FeedSection key={source} title={source}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {sourceArticles.slice(0, 10).map((article, idx) => (
                idx === 0 && sourceArticles.length > 3 ? (
                  <div key={article.id} className="col-span-2 row-span-2">
                    <LargeArticleCard
                      article={article}
                      index={articles.indexOf(article)}
                      onOpen={openReader}
                      formatDate={formatDate}
                      getStatusBadge={getStatusBadge}
                      isAuthenticated={isAuthenticated}
                      isSelected={selectedIds.has(article.id)}
                      onToggleSelect={toggleSelect}
                      onDelete={handleSingleDelete}
                      onToggleHidden={handleToggleHidden}
                      actionLoading={actionLoading}
                    />
                  </div>
                ) : (
                  <SmallArticleCard
                    key={article.id}
                    article={article}
                    index={articles.indexOf(article)}
                    onOpen={openReader}
                    formatDate={formatDate}
                    getStatusBadge={getStatusBadge}
                    isAuthenticated={isAuthenticated}
                    isSelected={selectedIds.has(article.id)}
                    onToggleSelect={toggleSelect}
                    onDelete={handleSingleDelete}
                    onToggleHidden={handleToggleHidden}
                    actionLoading={actionLoading}
                  />
                )
              ))}
            </div>
          </FeedSection>
        ))}

        {/* Load More */}
        {hasMore && (
          <div className="flex justify-center py-8">
            <Button onClick={loadMore} variant="outline" disabled={loadingMore}>
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Load More Articles
            </Button>
          </div>
        )}

        {/* Article Reader Modal */}
        {readerArticle && (
          <ArticleReader
            article={readerArticle}
            onClose={closeReader}
            onPrevious={() => navigateReader('prev')}
            onNext={() => navigateReader('next')}
            hasPrevious={readerIndex > 0}
            hasNext={readerIndex < articles.length - 1}
          />
        )}
      </div>
    </TooltipProvider>
  );
}


// Section wrapper component
interface FeedSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function FeedSection({ title, icon, children }: FeedSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// Horizontal scroll container with navigation
function HorizontalScroll({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="relative group">
      <button 
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/90 backdrop-blur border border-border shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
      <button 
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/90 backdrop-blur border border-border shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

// Shared props for article cards
interface ArticleCardProps {
  article: Article;
  index: number;
  onOpen: (article: Article, index: number) => void;
  formatDate: (date: string) => string;
  getStatusBadge: (article: Article, compact?: boolean) => React.ReactNode;
  isAuthenticated: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onDelete: (id: string, e?: React.MouseEvent) => Promise<void>;
  onToggleHidden: (article: Article, e?: React.MouseEvent) => Promise<void>;
  actionLoading: boolean;
}

// Hero article - full width with overlay
interface HeroArticleProps {
  article: Article;
  index: number;
  onOpen: (article: Article, index: number) => void;
  isAuthenticated: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onDelete: (id: string, e?: React.MouseEvent) => Promise<void>;
  onToggleHidden: (article: Article, e?: React.MouseEvent) => Promise<void>;
  actionLoading: boolean;
}

function HeroArticle({ 
  article, index, onOpen, isAuthenticated, isSelected, 
  onToggleSelect, onDelete, onToggleHidden, actionLoading 
}: HeroArticleProps) {
  return (
    <div 
      className={`relative h-[400px] md:h-[500px] rounded-2xl overflow-hidden cursor-pointer group ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={() => onOpen(article, index)}
    >
      {article.imageUrl ? (
        <img 
          src={article.imageUrl} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
      )}
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
      
      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              {article.sourceFeedName || 'News'}
            </Badge>
            <span className="text-white/70 text-sm flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(article.publicationDate).toLocaleDateString(undefined, { 
                month: 'long', day: 'numeric', year: 'numeric' 
              })}
            </span>
          </div>
          
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
            {article.title}
          </h1>
          
          {article.description && (
            <p className="text-white/80 text-base md:text-lg line-clamp-2 mb-6 max-w-2xl">
              {article.description}
            </p>
          )}
          
          <div className="flex items-center gap-3">
            <Button variant="glow" size="lg" onClick={(e) => { e.stopPropagation(); onOpen(article, index); }}>
              <BookOpen className="w-4 h-4 mr-2" />
              Read Article
            </Button>
            <Button variant="outline" size="lg" className="bg-white/10 border-white/20 text-white hover:bg-white/20" asChild>
              <a href={article.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Source
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Admin controls */}
      {isAuthenticated && (
        <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => onToggleSelect(article.id, e)}
            className="w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70"
          >
            {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => onToggleHidden(article, e)}
            disabled={actionLoading}
            className="w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70"
          >
            {article.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => onDelete(article.id, e)}
            disabled={actionLoading}
            className="w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-red-400 hover:bg-black/70"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}


// Large article card - for featured items
function LargeArticleCard({ 
  article, index, onOpen, formatDate, getStatusBadge, 
  isAuthenticated, isSelected, onToggleSelect, onDelete, onToggleHidden, actionLoading 
}: ArticleCardProps) {
  return (
    <Card 
      className={`group h-full overflow-hidden cursor-pointer hover:shadow-glow transition-all duration-300 ${article.isHidden ? 'opacity-50' : ''} ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={() => onOpen(article, index)}
    >
      <div className="relative h-48 md:h-64 overflow-hidden bg-muted">
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Status badge */}
        <div className="absolute top-3 left-3">
          {getStatusBadge(article, true)}
        </div>

        {/* Admin controls */}
        {isAuthenticated && (
          <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => onToggleSelect(article.id, e)}
              className="w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70"
            >
              {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={(e) => onToggleHidden(article, e)}
              disabled={actionLoading}
              className="w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70"
            >
              {article.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={(e) => onDelete(article.id, e)}
              disabled={actionLoading}
              className="w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-red-400 hover:bg-black/70"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <span className="font-medium text-foreground/80">{article.sourceFeedName || 'News'}</span>
          <span>•</span>
          <span>{formatDate(article.publicationDate)}</span>
          {article.isHidden && <Badge variant="secondary" className="text-[10px] px-1">Hidden</Badge>}
        </div>
        
        <h3 className="font-semibold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-2">
          {article.title}
        </h3>
        
        {article.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {article.description}
          </p>
        )}
        
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {article.tags.slice(0, 2).map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Small article card - for grids and horizontal scroll
function SmallArticleCard({ 
  article, index, onOpen, formatDate, getStatusBadge, 
  isAuthenticated, isSelected, onToggleSelect, onDelete, actionLoading 
}: ArticleCardProps) {
  return (
    <Card 
      className={`group flex-shrink-0 w-[280px] md:w-auto overflow-hidden cursor-pointer hover:shadow-glow transition-all duration-300 ${article.isHidden ? 'opacity-50' : ''} ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={() => onOpen(article, index)}
    >
      <div className="relative h-36 overflow-hidden bg-muted">
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Status badge */}
        <div className="absolute top-2 left-2">
          {getStatusBadge(article, true)}
        </div>

        {/* Admin controls */}
        {isAuthenticated && (
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => onToggleSelect(article.id, e)}
              className="w-6 h-6 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white hover:bg-black/70"
            >
              {isSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
            </button>
            <button
              onClick={(e) => onDelete(article.id, e)}
              disabled={actionLoading}
              className="w-6 h-6 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-red-400 hover:bg-black/70"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1.5">
          <span className="font-medium truncate">{article.sourceFeedName || 'News'}</span>
          <span>•</span>
          <span className="flex-shrink-0">{formatDate(article.publicationDate)}</span>
        </div>
        
        <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {article.title}
        </h3>
      </CardContent>
    </Card>
  );
}

// Compact article card - for sidebar lists
function CompactArticleCard({ 
  article, index, onOpen, formatDate, getStatusBadge, 
  isAuthenticated, isSelected, onToggleSelect, onDelete, actionLoading 
}: ArticleCardProps) {
  return (
    <div 
      className={`group flex gap-3 p-3 rounded-lg bg-card/50 hover:bg-card cursor-pointer transition-all ${article.isHidden ? 'opacity-50' : ''} ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={() => onOpen(article, index)}
    >
      {article.imageUrl && (
        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
          <img
            src={article.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
          <span className="font-medium truncate">{article.sourceFeedName || 'News'}</span>
          <span>•</span>
          <span>{formatDate(article.publicationDate)}</span>
        </div>
        
        <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {article.title}
        </h3>
        
        <div className="mt-1.5">
          {getStatusBadge(article, true)}
        </div>
      </div>

      {/* Admin controls */}
      {isAuthenticated && (
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => onToggleSelect(article.id, e)}
            className="w-6 h-6 rounded bg-muted flex items-center justify-center hover:bg-muted-foreground/20"
          >
            {isSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
          </button>
          <button
            onClick={(e) => onDelete(article.id, e)}
            disabled={actionLoading}
            className="w-6 h-6 rounded bg-muted flex items-center justify-center text-destructive hover:bg-destructive/20"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
