import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#2f3136',
            color: '#dcddde',
            border: '1px solid #202225',
          },
          success: { iconTheme: { primary: '#57F287', secondary: '#2f3136' } },
          error: { iconTheme: { primary: '#ED4245', secondary: '#2f3136' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
