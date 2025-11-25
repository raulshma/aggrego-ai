import { useState, useEffect, useCallback } from 'react';
import { articleApi } from '../services/api';
import type { Article, ConfidenceLevel } from '../types/api';
import { VerificationStatus, ConfidenceLevel as ConfidenceLevelValues } from '../types/api';
import './ArticleFeed.css';

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
        const confidenceClass = confidence === ConfidenceLevelValues.High ? 'high' 
          : confidence === ConfidenceLevelValues.Medium ? 'medium' : 'low';
        return (
          <span className={`status-badge verified ${confidenceClass}`}>
            ✓ Verified ({getConfidenceLabel(confidence)})
          </span>
        );
      }
      case VerificationStatus.InProgress:
        return <span className="status-badge in-progress">⏳ Verifying...</span>;
      default:
        return <span className="status-badge not-verified">○ Not Verified</span>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (error && articles.length === 0) {
    return (
      <div className="article-feed">
        <div className="feed-header">
          <h2>News Feed</h2>
          <button onClick={refresh} className="refresh-btn">Refresh</button>
        </div>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="article-feed">
      <div className="feed-header">
        <h2>News Feed</h2>
        <button onClick={refresh} className="refresh-btn" disabled={loading}>
          {loading && articles.length === 0 ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {articles.length === 0 && !loading ? (
        <p className="no-articles">No articles found. Add some RSS feeds to get started.</p>
      ) : (
        <div className="article-list">
          {articles.map((article) => (
            <article key={article.id} className="article-card">
              <div className="article-header">
                <h3 className="article-title">
                  <a href={article.link} target="_blank" rel="noopener noreferrer">
                    {article.title}
                  </a>
                </h3>
                {getStatusBadge(article)}
              </div>
              
              <div className="article-meta">
                <span className="source">{article.sourceFeedName || 'Unknown Source'}</span>
                <span className="date">{formatDate(article.publicationDate)}</span>
              </div>

              {article.description && (
                <p className="article-description">{article.description}</p>
              )}

              {article.tags.length > 0 && (
                <div className="article-tags">
                  {article.tags.map((tag, i) => (
                    <span key={i} className="tag">{tag}</span>
                  ))}
                </div>
              )}

              <div className="article-actions">
                {article.verificationStatus !== VerificationStatus.InProgress && (
                  <button
                    onClick={() => onVerifyClick?.(article)}
                    className="verify-btn"
                  >
                    {article.verificationStatus === VerificationStatus.Verified ? 'Re-verify' : 'Verify'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {hasMore && articles.length > 0 && (
        <div className="load-more">
          <button onClick={loadMore} disabled={loading}>
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
