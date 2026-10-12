import { useState } from 'react';
import { api, img, money, toFormData } from '../api.js';
import { Badge, Empty, ErrorMsg, Field, ImageInput, Modal, PageHeader, useLoad } from '../components/ui.jsx';

const EMPTY = { name: '', description: '', sku: '', category: '', price: '', cost: '', stock: '', min_stock: '', in_catalog: true, active: true };

export default function Products() {
  const [q, setQ] = useState('');
  const { data, error, reload } = useLoad(`/products?q=${encodeURIComponent(q)}`, [q]);
  const { data: categories } = useLoad('/products/categories');
  const [editing, setEditing] = useState(null);

  const remove = async (p) => {
    if (!confirm(`¿Eliminar "${p.name}"? También se borrará su historial de inventario.`)) return;
    try { await api(`/products/${p.id}`, { method: 'DELETE' }); reload(); } catch (e) { alert(e.message); }
  };

  return (
    <>
      <PageHeader title="Productos" subtitle="Los productos marcados “en catálogo” se muestran en tu tienda pública">
        <button className="btn primary" onClick={() => setEditing(EMPTY)}>+ Nuevo producto</button>
      </PageHeader>
      <div className="toolbar">
        <input className="search" placeholder="Buscar por nombre, SKU o categoría…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorMsg>{error}</ErrorMsg>
      {data && !data.length && <Empty>No hay productos.</Empty>}
      {data?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th /><th>Producto</th><th>Categoría</th><th className="num">Precio</th><th className="num">Costo</th><th className="num">Stock</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td className="thumb-cell">{p.image ? <img className="thumb" src={img(p.image)} alt="" /> : <div className="thumb empty-thumb" />}</td>
                  <td><strong>{p.name}</strong>{p.sku && <div className="muted small">SKU {p.sku}</div>}</td>
                  <td>{p.category}</td>
                  <td className="num">{money(p.price)}</td>
                  <td className="num">{money(p.cost)}</td>
                  <td className={`num ${p.stock <= p.min_stock ? 'danger-text' : ''}`}>{p.stock}</td>
                  <td>
                    {p.active ? <Badge tone="green">Activo</Badge> : <Badge>Inactivo</Badge>}{' '}
                    {p.in_catalog ? <Badge tone="blue">En catálogo</Badge> : null}
                  </td>
                  <td className="actions-cell">
                    <button className="btn ghost small" onClick={() => setEditing(p)}>Editar</button>
                    <button className="btn ghost small danger" onClick={() => remove(p)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <ProductForm
          product={editing}
          categories={categories || []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </>
  );
}

function ProductForm({ product, categories, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, ...product, in_catalog: !!product.in_catalog, active: !!product.active });
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const isNew = !product.id;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { name, description, sku, category, price, cost, min_stock, in_catalog, active, stock } = form;
      const fd = toFormData({ name, description, sku, category, price, cost, min_stock, in_catalog, active, stock: isNew ? stock : undefined });
      if (file) fd.append('image', file);
      if (removeImage && !file) fd.append('remove_image', '1');
      await api(isNew ? '/products' : `/products/${product.id}`, { method: isNew ? 'POST' : 'PUT', body: fd });
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal title={isNew ? 'Nuevo producto' : 'Editar producto'} onClose={onClose} wide>
      <form onSubmit={submit} className="form-grid">
        <ErrorMsg>{error}</ErrorMsg>
        <Field label="Nombre *" full><input value={form.name} onChange={set('name')} required /></Field>
        <Field label="Categoría">
          <input list="product-categories" value={form.category} onChange={set('category')} />
          <datalist id="product-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="SKU / Código"><input value={form.sku} onChange={set('sku')} /></Field>
        <Field label="Precio de venta"><input type="number" min="0" step="any" value={form.price} onChange={set('price')} /></Field>
        <Field label="Costo"><input type="number" min="0" step="any" value={form.cost} onChange={set('cost')} /></Field>
        {isNew ? (
          <Field label="Stock inicial"><input type="number" min="0" value={form.stock} onChange={set('stock')} /></Field>
        ) : (
          <Field label="Stock actual" hint="Se modifica desde Inventario o con ventas"><input value={product.stock} disabled /></Field>
        )}
        <Field label="Stock mínimo (alerta)"><input type="number" min="0" value={form.min_stock} onChange={set('min_stock')} /></Field>
        <Field label="Descripción" full><textarea rows={3} value={form.description} onChange={set('description')} /></Field>
        <ImageInput value={removeImage ? '' : product.image} onFile={setFile} onRemove={() => setRemoveImage(true)} />
        <label className="check"><input type="checkbox" checked={form.in_catalog} onChange={set('in_catalog')} /> Mostrar en el catálogo de la tienda</label>
        <label className="check"><input type="checkbox" checked={form.active} onChange={set('active')} /> Producto activo</label>
        <div className="form-actions full">
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  );
}
