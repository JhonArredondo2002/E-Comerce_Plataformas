import { useState } from 'react';
import { api, dateTime, money } from '../api.js';
import { Badge, Empty, ErrorMsg, Field, Modal, PageHeader, useLoad } from '../components/ui.jsx';

const TYPE = {
  entrada: ['Entrada', 'green'],
  salida: ['Salida', 'red'],
  ajuste: ['Ajuste', 'yellow'],
  venta: ['Venta', 'blue'],
  anulacion: ['Anulación', 'gray'],
};

export default function Inventory() {
  const [tab, setTab] = useState('stock');
  const [lowOnly, setLowOnly] = useState(false);
  const products = useLoad(`/products?active=1${lowOnly ? '&low=1' : ''}`, [lowOnly]);
  const movements = useLoad('/inventory/movements');
  const [moving, setMoving] = useState(null);

  const reloadAll = () => { products.reload(); movements.reload(); };

  return (
    <>
      <PageHeader title="Inventario" subtitle="Existencias y movimientos de tus productos">
        <button className="btn primary" onClick={() => setMoving({})}>+ Registrar movimiento</button>
      </PageHeader>
      <div className="tabs">
        <button className={tab === 'stock' ? 'active' : ''} onClick={() => setTab('stock')}>Existencias</button>
        <button className={tab === 'mov' ? 'active' : ''} onClick={() => setTab('mov')}>Movimientos</button>
      </div>

      {tab === 'stock' && (
        <>
          <div className="toolbar">
            <label className="check"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Solo stock bajo</label>
          </div>
          <ErrorMsg>{products.error}</ErrorMsg>
          {products.data && !products.data.length && <Empty>No hay productos para mostrar.</Empty>}
          {products.data?.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Producto</th><th className="num">Stock</th><th className="num">Mínimo</th><th className="num">Valor (costo)</th><th /></tr></thead>
                <tbody>
                  {products.data.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className={`num ${p.stock <= p.min_stock ? 'danger-text' : ''}`}>{p.stock}</td>
                      <td className="num">{p.min_stock}</td>
                      <td className="num">{money(p.stock * p.cost)}</td>
                      <td className="actions-cell">
                        <button className="btn ghost small" onClick={() => setMoving({ product_id: p.id, type: 'entrada' })}>+ Entrada</button>
                        <button className="btn ghost small" onClick={() => setMoving({ product_id: p.id, type: 'salida' })}>− Salida</button>
                        <button className="btn ghost small" onClick={() => setMoving({ product_id: p.id, type: 'ajuste', quantity: p.stock })}>Ajustar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'mov' && (
        <>
          <ErrorMsg>{movements.error}</ErrorMsg>
          {movements.data && !movements.data.length && <Empty>Sin movimientos.</Empty>}
          {movements.data?.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="num">Cantidad</th><th className="num">Stock final</th><th>Motivo</th><th>Usuario</th></tr></thead>
                <tbody>
                  {movements.data.map((m) => (
                    <tr key={m.id}>
                      <td>{dateTime(m.created_at)}</td>
                      <td>{m.product_name}</td>
                      <td><Badge tone={TYPE[m.type][1]}>{TYPE[m.type][0]}</Badge></td>
                      <td className="num">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                      <td className="num">{m.stock_after}</td>
                      <td>{m.reason}</td>
                      <td>{m.user_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {moving && (
        <MovementForm
          initial={moving}
          onClose={() => setMoving(null)}
          onSaved={() => { setMoving(null); reloadAll(); }}
        />
      )}
    </>
  );
}

function MovementForm({ initial, onClose, onSaved }) {
  const { data: products } = useLoad('/products?active=1');
  const [form, setForm] = useState({ product_id: '', type: 'entrada', quantity: '', reason: '', ...initial });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const product = products?.find((p) => String(p.id) === String(form.product_id));

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/inventory/movements', { method: 'POST', body: { ...form, quantity: Number(form.quantity) } });
      onSaved();
    } catch (err) { setError(err.message); }
  };

  return (
    <Modal title="Registrar movimiento" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <ErrorMsg>{error}</ErrorMsg>
        <Field label="Producto *" full>
          <select value={form.product_id} onChange={set('product_id')} required>
            <option value="">Selecciona…</option>
            {products?.map((p) => <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select value={form.type} onChange={set('type')}>
            <option value="entrada">Entrada (suma)</option>
            <option value="salida">Salida (resta)</option>
            <option value="ajuste">Ajuste (fija el stock)</option>
          </select>
        </Field>
        <Field label={form.type === 'ajuste' ? 'Nuevo stock *' : 'Cantidad *'} hint={product ? `Stock actual: ${product.stock}` : ''}>
          <input type="number" min={form.type === 'ajuste' ? 0 : 1} value={form.quantity} onChange={set('quantity')} required />
        </Field>
        <Field label="Motivo" full><input value={form.reason} onChange={set('reason')} placeholder="Compra a proveedor, daño, conteo físico…" /></Field>
        <div className="form-actions full">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
