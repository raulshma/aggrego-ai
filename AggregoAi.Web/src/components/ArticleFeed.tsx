import { useState, useEffect, useCallback } from 'react';
import { articleApi } from '../services/api';
import type { Article, ConfidenceLevel } from '../types/api';
import { VerificationStatus, ConfidenceLevel as ConfidenceLevelValues } from '../types/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ExternalLink, Shield, ShieldCheck, ShieldAlert, Clock, Loader2 } from 'lucide-react';

interface ArticleFeedProps {
  onVerifyClick?: (article: Article) => void;
}

export function ArticleFeed({ onVerifyClick }: ArticleFeedProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
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
    loadArticles(0);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">News Feed</h2>
          <p className="text-muted-foreground text-sm">AI-verified news from your sources</p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm" disabled={loading && articles.length === 0}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading && articles.length === 0 ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Articles Grid */}
      {articles.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No articles yet</h3>
            <p className="text-muted-foreground text-sm">Add some RSS feeds to start aggregating news.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Card key={article.id} className="group flex flex-col">
              <CardContent className="p-5 flex flex-col flex-1">
                {/* Header with status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">{article.sourceFeedName || 'Unknown'}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(article.publicationDate)}
                    </span>
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
                    <Button
                      onClick={() => onVerifyClick?.(article)}
                      variant="glow"
                      size="sm"
                      className="flex-1"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {article.verificationStatus === VerificationStatus.Verified ? 'Re-verify' : 'Verify'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a href={article.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
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
  );
}
