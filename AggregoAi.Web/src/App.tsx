import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArticleFeed } from './components/ArticleFeed';
import { VerificationPanel } from './components/VerificationPanel';
import { JobMonitor } from './components/JobMonitor';
import { ConfigPanel } from './components/ConfigPanel';
import { FeedManager } from './components/FeedManager';
import type { Article } from './types/api';
import { Newspaper, Cog, Rss, Settings2, Sparkles } from 'lucide-react';

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
    <div className="min-h-screen relative">
      {/* Aurora background effect */}
      <div className="aurora-bg" />
      
      {/* Header */}
      <header className="sticky top-0 z-40 glass-strong border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-primary to-accent opacity-30 blur-sm -z-10" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  AggregoAi
                </h1>
                <p className="text-xs text-muted-foreground -mt-0.5">AI-Powered News</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
              <TabsList className="hidden sm:flex">
                <TabsTrigger value="feed" className="gap-2">
                  <Newspaper className="w-4 h-4" />
                  <span className="hidden md:inline">Feed</span>
                </TabsTrigger>
                <TabsTrigger value="jobs" className="gap-2">
                  <Cog className="w-4 h-4" />
                  <span className="hidden md:inline">Jobs</span>
                </TabsTrigger>
                <TabsTrigger value="feeds" className="gap-2">
                  <Rss className="w-4 h-4" />
                  <span className="hidden md:inline">Sources</span>
                </TabsTrigger>
                <TabsTrigger value="config" className="gap-2">
                  <Settings2 className="w-4 h-4" />
                  <span className="hidden md:inline">Config</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 glass-strong border-t border-border/50 px-2 py-2">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="feed" className="flex-col gap-1 py-2">
              <Newspaper className="w-5 h-5" />
              <span className="text-[10px]">Feed</span>
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex-col gap-1 py-2">
              <Cog className="w-5 h-5" />
              <span className="text-[10px]">Jobs</span>
            </TabsTrigger>
            <TabsTrigger value="feeds" className="flex-col gap-1 py-2">
              <Rss className="w-5 h-5" />
              <span className="text-[10px]">Sources</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex-col gap-1 py-2">
              <Settings2 className="w-5 h-5" />
              <span className="text-[10px]">Config</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 sm:pb-6">
        {activeTab === 'feed' && <ArticleFeed onVerifyClick={handleVerifyClick} />}
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
