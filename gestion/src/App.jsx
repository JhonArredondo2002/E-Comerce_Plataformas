import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import Products from './pages/Products.jsx';
import Inventory from './pages/Inventory.jsx';
import Sales from './pages/Sales.jsx';
import NewSale from './pages/NewSale.jsx';
import Ads from './pages/Ads.jsx';
import Collaborators from './pages/Collaborators.jsx';
import BusinessProfile from './pages/BusinessProfile.jsx';
import Account from './pages/Account.jsx';
import SuperBusinesses from './pages/SuperBusinesses.jsx';

export default function App() {
  const { user, loading, isSuper } = useAuth();

  if (loading) return <div className="center-screen">Cargando…</div>;
  if (!user)
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );

  return (
    <Routes>
      <Route element={<Layout />}>
        {isSuper ? (
          <>
            <Route path="/" element={<SuperBusinesses />} />
            <Route path="/cuenta" element={<Account />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clients />} />
            <Route path="/productos" element={<Products />} />
            <Route path="/inventario" element={<Inventory />} />
            <Route path="/ventas" element={<Sales />} />
            <Route path="/ventas/nueva" element={<NewSale />} />
            <Route path="/anuncios" element={<Ads />} />
            <Route path="/colaboradores" element={<Collaborators />} />
            <Route path="/negocio" element={<BusinessProfile />} />
            <Route path="/cuenta" element={<Account />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
