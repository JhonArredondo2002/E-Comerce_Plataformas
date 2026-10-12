import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, img, money } from '../api.js';
import { ErrorMsg, Field, PageHeader, useLoad } from '../components/ui.jsx';
import { ClientForm } from './Clients.jsx';

export default function NewSale() {
  const navigate = useNavigate();
  const { data: products } = useLoad('/products?active=1');
  const clients = useLoad('/clients');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState([]);
  const [clientId, setClientId] = useState('');
  const [payment, setPayment] = useState('efectivo');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newClient, setNewClient] = useState(false);

  const filtered = useMemo(
    () => (products || []).filter((p) => `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(q.toLowerCase())),
    [products, q]
  );
  const total = cart.reduce((a, i) => a + i.quantity * i.unit_price, 0);

  const add = (p) => {
    setCart((c) => {
      const found = c.find((i) => i.product_id === p.id);
      if (found) return c.map((i) => (i.product_id === p.id ? { ...i, quantity: Math.min(i.quantity + 1, p.stock) } : i));
      return [...c, { product_id: p.id, name: p.name, unit_price: p.price, quantity: 1, stock: p.stock }];
    });
  };
  const update = (id, k, v) => setCart((c) => c.map((i) => (i.product_id === id ? { ...i, [k]: v } : i)));
  const remove = (id) => setCart((c) => c.filter((i) => i.product_id !== id));

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const { id } = await api('/sales', {
        method: 'POST',
        body: {
          client_id: clientId ? Number(clientId) : null,
          payment_method: payment,
          notes,
          items: cart.map((i) => ({ product_id: i.product_id, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
        },
      });
      alert(`Venta #${id} registrada por ${money(total)}`);
      navigate('/ventas');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Nueva venta" subtitle="Agrega productos y confirma la venta" />
      <div className="pos">
        <section className="card">
          <input className="search" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <div className="pos-products">
            {filtered.map((p) => (
              <button key={p.id} className="pos-item" onClick={() => add(p)} disabled={p.stock <= 0}>
                {p.image ? <img src={img(p.image)} alt="" /> : <div className="pos-noimg">{p.name[0]}</div>}
                <strong>{p.name}</strong>
                <span>{money(p.price)}</span>
                <small className={p.stock <= 0 ? 'danger-text' : 'muted'}>{p.stock <= 0 ? 'Agotado' : `Stock: ${p.stock}`}</small>
              </button>
            ))}
            {products && !filtered.length && <p className="muted">Sin resultados.</p>}
          </div>
        </section>

        <section className="card cart">
          <h3>Detalle</h3>
          <ErrorMsg>{error}</ErrorMsg>
          {!cart.length && <p className="muted">Haz clic en un producto para agregarlo.</p>}
          {cart.map((i) => (
            <div key={i.product_id} className="cart-line">
              <div className="cart-name">{i.name}</div>
              <input type="number" min="1" max={i.stock} value={i.quantity} onChange={(e) => update(i.product_id, 'quantity', e.target.value)} title="Cantidad" />
              <input type="number" min="0" step="any" value={i.unit_price} onChange={(e) => update(i.product_id, 'unit_price', e.target.value)} title="Precio unitario" />
              <strong className="num">{money(i.quantity * i.unit_price)}</strong>
              <button className="icon-btn" onClick={() => remove(i.product_id)} aria-label="Quitar">✕</button>
            </div>
          ))}
          <div className="form-grid">
            <Field label="Cliente" full>
              <div className="row gap">
                <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">Consumidor final</option>
                  {clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}{c.document ? ` · ${c.document}` : ''}</option>)}
                </select>
                <button type="button" className="btn secondary small" onClick={() => setNewClient(true)}>+ Nuevo</button>
              </div>
            </Field>
            <Field label="Método de pago">
              <select value={payment} onChange={(e) => setPayment(e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="nequi">Nequi / Daviplata</option>
                <option value="credito">Crédito</option>
              </select>
            </Field>
            <Field label="Notas"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </div>
          <div className="cart-total"><span>Total</span><strong>{money(total)}</strong></div>
          <button className="btn primary block" disabled={!cart.length || busy} onClick={submit}>
            {busy ? 'Registrando…' : 'Confirmar venta'}
          </button>
        </section>
      </div>
      {newClient && (
        <ClientForm
          client={{}}
          onClose={() => setNewClient(false)}
          onSaved={async (c) => { setNewClient(false); await clients.reload(); setClientId(String(c.id)); }}
        />
      )}
    </>
  );
}
