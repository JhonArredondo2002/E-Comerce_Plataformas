import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Store from './Store.jsx';
import Home from './Home.jsx';
import { setFavicon } from '@shared/brand.js';
import './styles.css';

setFavicon();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Cada negocio se ve en /<slug-del-negocio> */}
        <Route path="/:slug" element={<Store />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
