import { useState } from 'react';
import { ArticleFeed } from './components/ArticleFeed';
import { VerificationPanel } from './components/VerificationPanel';
import { JobMonitor } from './components/JobMonitor';
import { ConfigPanel } from './components/ConfigPanel';
import { FeedManager } from './components/FeedManager';
import type { Article } from './types/api';
import './App.css';

type Tab = 'feed' | 'jobs' | 'feeds' | 'config';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [verifyingArticle, setVerifyingArticle] = useState<Article | null>(null);

  const handleVerifyClick = (article: Article) => {
    setVerifyingArticle(article);
  };

  const handleCloseVerification = () => {
    setVerifyingArticle(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>AggregoAi</h1>
          <p>AI-Powered News Aggregator</p>
        </div>
        <nav className="main-nav">
          <button
            className={activeTab === 'feed' ? 'active' : ''}
            onClick={() => setActiveTab('feed')}
          >
            📰 News Feed
          </button>
          <button
            className={activeTab === 'jobs' ? 'active' : ''}
            onClick={() => setActiveTab('jobs')}
          >
            ⚙️ Jobs
          </button>
          <button
            className={activeTab === 'feeds' ? 'active' : ''}
            onClick={() => setActiveTab('feeds')}
          >
            📡 Feeds
          </button>
          <button
            className={activeTab === 'config' ? 'active' : ''}
            onClick={() => setActiveTab('config')}
          >
            🔧 Config
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'feed' && (
          <ArticleFeed onVerifyClick={handleVerifyClick} />
        )}
        {activeTab === 'jobs' && <JobMonitor />}
        {activeTab === 'feeds' && <FeedManager />}
        {activeTab === 'config' && <ConfigPanel />}
      </main>

      <VerificationPanel
        article={verifyingArticle}
        onClose={handleCloseVerification}
      />
    </div>
  );
}

export default App;
