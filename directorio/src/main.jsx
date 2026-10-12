import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Directory from './Directory.jsx';
import { setFavicon } from '@shared/brand.js';
import './styles.css';

setFavicon();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<Directory />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
