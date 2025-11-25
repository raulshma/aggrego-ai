import { useState, useEffect, useCallback } from 'react';
import { articleApi } from '../services/api';
import type { Article, ConfidenceLevel } from '../types/api';
import { VerificationStatus, ConfidenceLevel as ConfidenceLevelValues } from '../types/api';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, ExternalLink, Shield, ShieldCheck, ShieldAlert, Clock, Loader2, Trash2, EyeOff, Eye, CheckSquare, Square } from 'lucide-react';

interface ArticleFeedProps {
  onVerifyClick?: (article: Article) => void;
}

export function ArticleFeed({ onVerifyClick }: ArticleFeedProps) {
  const { isAuthenticated } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const limit = 20;

  const loadArticles = useCallback(async (newOffset: number, append = false) => {
    try {
      setLoading(true);
      setError(null);
      const response = await articleApi.getArticles(limit, newOffset);
      
      if (append) {
        setArticles(prev => [...prev, ...response.articles]);
      } else {
        setArticles(response.articles);
      }
      
      setHasMore(response.articles.length === limit);
      setOffset(newOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArticles(0);
  }, [loadArticles]);

  const loadMore = () => {
    if (!loading && hasMore) {
      loadArticles(offset + limit, true);
    }
  };

  const refresh = () => {
    setSelectedIds(new Set());
    loadArticles(0);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === articles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(articles.map(a => a.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} article(s)? This cannot be undone.`)) return;

    setActionLoading(true);
    try {
      await articleApi.bulkDeleteArticles(Array.from(selectedIds));
      setSelectedIds(new Set());
      await loadArticles(0);
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
      await loadArticles(0);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update articles');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSingleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;

    setActionLoading(true);
    try {
      await articleApi.deleteArticle(id);
      await loadArticles(0);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete article');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleHidden = async (article: Article) => {
    setActionLoading(true);
    try {
      await articleApi.setArticleHidden(article.id, !article.isHidden);
      await loadArticles(0);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update article');
    } finally {
      setActionLoading(false);
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

  const getStatusBadge = (article: Article) => {
    switch (article.verificationStatus) {
      case VerificationStatus.Verified: {
        const confidence = article.verdict?.confidence;
        const variant = confidence === ConfidenceLevelValues.High ? 'success' 
          : confidence === ConfidenceLevelValues.Medium ? 'warning' : 'destructive';
        return (
          <Badge variant={variant} className="gap-1">
            <ShieldCheck className="w-3 h-3" />
            Verified ({getConfidenceLabel(confidence)})
          </Badge>
        );
      }
      case VerificationStatus.InProgress:
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Verifying
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <ShieldAlert className="w-3 h-3" />
            Unverified
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

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
          <CardContent className="p-6 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">News Feed</h2>
          <p className="text-muted-foreground text-sm">AI-verified news from your sources</p>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated && selectedIds.size > 0 && (
            <>
              <Badge variant="secondary">{selectedIds.size} selected</Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => handleBulkHide(true)} variant="outline" size="sm" disabled={actionLoading}>
                    <EyeOff className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Hide selected</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => handleBulkHide(false)} variant="outline" size="sm" disabled={actionLoading}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Unhide selected</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleBulkDelete} variant="outline" size="sm" disabled={actionLoading} className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete selected</TooltipContent>
              </Tooltip>
            </>
          )}
          {isAuthenticated && articles.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={selectAll} variant="outline" size="sm">
                  {selectedIds.size === articles.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{selectedIds.size === articles.length ? 'Deselect all' : 'Select all'}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={refresh} variant="outline" size="sm" disabled={loading && articles.length === 0}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading && articles.length === 0 ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh articles</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Articles Grid */}
      {articles.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No articles yet</h3>
            <p className="text-muted-foreground text-sm">Check back soon for the latest news.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Card key={article.id} className={`group flex flex-col overflow-hidden ${article.isHidden ? 'opacity-50' : ''} ${selectedIds.has(article.id) ? 'ring-2 ring-primary' : ''}`}>
              {/* Article Image */}
              {article.imageUrl && (
                <div className="relative h-40 overflow-hidden bg-muted">
                  <img
                    src={article.imageUrl}
                    alt=""
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {isAuthenticated && (
                    <button
                      onClick={() => toggleSelect(article.id)}
                      className="absolute top-2 left-2 w-6 h-6 rounded bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                    >
                      {selectedIds.has(article.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              )}
              <CardContent className="p-5 flex flex-col flex-1">
                {/* Header with status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {isAuthenticated && !article.imageUrl && (
                      <button onClick={() => toggleSelect(article.id)} className="mr-1">
                        {selectedIds.has(article.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                      </button>
                    )}
                    <span className="font-medium text-foreground/80">{article.sourceFeedName || 'Unknown'}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(article.publicationDate)}
                    </span>
                    {article.isHidden && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                  </div>
                  {getStatusBadge(article)}
                </div>

                {/* Title */}
                <h3 className="font-semibold text-base leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  <a href={article.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {article.title}
                  </a>
                </h3>

                {/* Description */}
                {article.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3 flex-1">
                    {article.description}
                  </p>
                )}

                {/* Tags */}
                {article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {article.tags.slice(0, 3).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs px-2 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {article.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs px-2 py-0">
                        +{article.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-auto pt-3 border-t border-border/50">
                  {article.verificationStatus !== VerificationStatus.InProgress && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => onVerifyClick?.(article)}
                          variant="glow"
                          size="sm"
                          className="flex-1"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          {article.verificationStatus === VerificationStatus.Verified ? 'Re-verify' : 'Verify'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {article.verificationStatus === VerificationStatus.Verified ? 'Re-verify this article with AI' : 'Verify this article with AI'}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a href={article.link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open article in new tab</TooltipContent>
                  </Tooltip>
                  {isAuthenticated && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={() => handleToggleHidden(article)} variant="outline" size="sm" disabled={actionLoading}>
                            {article.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{article.isHidden ? 'Unhide article' : 'Hide article'}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={() => handleSingleDelete(article.id)} variant="outline" size="sm" disabled={actionLoading} className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete article</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && articles.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button onClick={loadMore} variant="outline" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
