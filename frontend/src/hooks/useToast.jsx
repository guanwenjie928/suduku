import { useState, useCallback, useRef } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((message, type = 'success', duration = 2000) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const ToastContainer = useCallback(() => {
    if (toasts.length === 0) return null;
    return (
      <div style={{
        position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none'
      }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            padding: '12px 24px', borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', gap: '8px',
            pointerEvents: 'auto',
            background: toast.type === 'success'
              ? 'linear-gradient(to right,#34d399,#14b8a6)'
              : 'linear-gradient(to right,#fbbf24,#f97316)',
            color: 'white', animation: 'toastIn 0.3s ease-out',
            fontWeight: 'bold', whiteSpace: 'nowrap'
          }}>
            <span style={{ fontSize: '20px' }}>{toast.type === 'success' ? '\u2713' : '\u26A0'}</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    );
  }, [toasts]);

  return { showToast, ToastContainer };
}
