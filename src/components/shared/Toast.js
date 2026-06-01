import React, { useState, useCallback } from 'react';
let toastId = 0;
let globalAdd = null;
export function useToast() {
  return { toast: useCallback((msg, type = 's') => { if (globalAdd) globalAdd(msg, type); }, []) };
}
export function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  globalAdd = (msg, type) => {
    const id = ++toastId;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };
  if (!toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.type === 's' ? '✓' : '✕'}</span>{t.msg}
        </div>
      ))}
    </div>
  );
}
