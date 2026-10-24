import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface RouterNavigateOptions {
  replace?: boolean;
}

interface RouterContextType {
  currentRoute: string;
  navigate: (path: string, options?: RouterNavigateOptions) => void;
  pathname: string;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

// Helper to extract clean HTML5 pathname and migrate legacy hash URLs if present
function getInitialRoute(): string {
  if (typeof window === 'undefined') return '/';

  // If a legacy hash route exists (e.g. /#/operations/attendance), cleanly migrate to clean path:
  if (window.location.hash && (window.location.hash.startsWith('#/') || window.location.hash.startsWith('#'))) {
    const raw = window.location.hash.replace(/^#/, '');
    const cleanPath = raw.startsWith('/') ? raw : `/${raw}`;
    try {
      window.history.replaceState(null, '', cleanPath);
    } catch {
      // Ignore if in restricted iframe/sandbox
    }
    return cleanPath;
  }

  const path = window.location.pathname + window.location.search;
  return path === '' ? '/' : path;
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<string>(getInitialRoute);

  useEffect(() => {
    // If a hash exists on mount or change, migrate it immediately to a clean HTML5 URL
    if (typeof window !== 'undefined' && window.location.hash && (window.location.hash.startsWith('#/') || window.location.hash.startsWith('#'))) {
      const raw = window.location.hash.replace(/^#/, '');
      const cleanPath = raw.startsWith('/') ? raw : `/${raw}`;
      try {
        window.history.replaceState(null, '', cleanPath);
      } catch {
        // Ignore
      }
      setCurrentRoute(cleanPath);
    }

    const handlePopState = () => {
      const path = window.location.pathname + window.location.search;
      setCurrentRoute(path === '' ? '/' : path);
    };

    const handleHashChange = () => {
      // If a hash change happens, strip it and sync
      if (window.location.hash) {
        const raw = window.location.hash.replace(/^#/, '');
        const cleanPath = raw.startsWith('/') ? raw : `/${raw}`;
        try {
          window.history.replaceState(null, '', cleanPath);
        } catch {
          // Ignore
        }
        setCurrentRoute(cleanPath);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const navigate = useCallback((path: string, options?: RouterNavigateOptions) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    try {
      if (options?.replace) {
        window.history.replaceState(null, '', cleanPath);
      } else {
        window.history.pushState(null, '', cleanPath);
      }
    } catch {
      // Fallback
    }
    setCurrentRoute(cleanPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const pathname = currentRoute.split('?')[0].split('#')[0];

  return (
    <RouterContext.Provider value={{ currentRoute, navigate, pathname }}>
      {children}
    </RouterContext.Provider>
  );
};

export function useRouter(): RouterContextType {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}

