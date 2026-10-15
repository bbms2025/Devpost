import React from 'react';
import ReactDOM from 'react-dom/client';
import { PanelApp } from './PanelApp';
import './styles/tokens.css';
import './styles/panel.css';

// Apply theme from system preference (ChatGPT tab DOM not accessible from panel)
function applyTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
}

applyTheme();

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
});

function mount() {
  const root = document.getElementById('root');
  if (!root) {
    console.error('[AI Chat Organizer] #root element not found');
    return;
  }
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <PanelApp />
    </React.StrictMode>
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
