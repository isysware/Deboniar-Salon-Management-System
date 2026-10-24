import { AuthProvider } from './context/AuthContext';
import { RouterProvider } from './context/RouterContext';
import { ToastProvider } from './context/ToastContext';
import { AppRouter } from './app/AppRouter';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RouterProvider>
          <AppRouter />
        </RouterProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

