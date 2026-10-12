// Datos de demostración: npm run seed
import bcrypt from 'bcryptjs';
import db from './db.js';
import { setServices } from './utils.js';

const hash = (p) => bcrypt.hashSync(p, 10);

if (!db.prepare(`SELECT id FROM users WHERE role='superadmin'`).get()) {
  db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,'superadmin')`).run(
    'Super Administrador', 'super@plataforma.com', hash('super123')
  );
}

const demo = [
  {
    business: {
      name: 'Café Aroma', slug: 'cafe-aroma', category: 'Restaurantes y cafés', city: 'Bogotá', neighborhood: 'Chapinero',
      description: 'Café de especialidad colombiano, postres artesanales y desayunos.',
      address: 'Cra 7 # 45-12', phone: '6015551234', whatsapp: '573001112233',
      email: 'hola@cafearoma.co', instagram: 'https://instagram.com/cafearoma', facebook: 'https://facebook.com/cafearoma',
      schedule: 'Lun a Sáb 7:00 a.m. – 8:00 p.m.', primary_color: '#92400e',
      maps_url: 'https://maps.google.com/?q=4.6371,-74.0640', latitude: 4.6371, longitude: -74.064,
    },
    services: ['Domicilios', 'Wifi', 'Para llevar'],
    admin: ['Laura Gómez', 'admin@cafearoma.co'],
    collaborator: ['Andrés Ruiz', 'andres@cafearoma.co', 'Barista'],
    products: [
      ['Café americano', 'Bebidas', 4500, 1500, 100, 'Taza de 12 oz con café de origen Huila.'],
      ['Capuchino', 'Bebidas', 7000, 2500, 80, 'Espresso doble con leche texturizada.'],
      ['Torta de zanahoria', 'Postres', 9000, 3500, 20, 'Porción con frosting de queso crema.'],
      ['Café en grano 500 g', 'Café para llevar', 38000, 22000, 4, 'Tostión media, notas a chocolate.'],
    ],
    ads: [['2x1 en capuchinos', 'Todos los martes de 3 a 5 p.m.'], ['Nuevo menú de desayunos', 'Pregunta por nuestros combos desde $15.000.']],
  },
  {
    business: {
      name: 'TecnoFix Medellín', slug: 'tecnofix-medellin', category: 'Tecnología', city: 'Medellín', neighborhood: 'La Candelaria',
      description: 'Reparación de celulares y computadores, venta de accesorios.',
      address: 'Calle 50 # 50-20, Centro', phone: '6045559876', whatsapp: '573104445566',
      email: 'contacto@tecnofix.co', instagram: 'https://instagram.com/tecnofix', tiktok: 'https://tiktok.com/@tecnofix',
      schedule: 'Lun a Vie 9:00 a.m. – 6:00 p.m.', primary_color: '#0f766e',
      maps_url: 'https://maps.google.com/?q=6.2476,-75.5658', latitude: 6.2476, longitude: -75.5658,
    },
    services: ['Reparación', 'Domicilios', 'Garantía'],
    admin: ['Carlos Pérez', 'admin@tecnofix.co'],
    collaborator: ['Sofía Mejía', 'sofia@tecnofix.co', 'Técnica'],
    products: [
      ['Cargador USB-C 20W', 'Accesorios', 45000, 22000, 30, 'Carga rápida compatible con la mayoría de equipos.'],
      ['Audífonos Bluetooth', 'Accesorios', 89000, 45000, 12, 'Hasta 20 horas de batería.'],
      ['Cambio de pantalla (mano de obra)', 'Servicios', 60000, 0, 999, 'Precio de mano de obra, repuesto aparte.'],
      ['Vidrio templado', 'Accesorios', 15000, 4000, 3, 'Protector para múltiples referencias.'],
    ],
    ads: [['Diagnóstico gratis', 'Trae tu equipo y te decimos qué tiene sin costo.']],
  },
];

for (const d of demo) {
  if (db.prepare('SELECT id FROM businesses WHERE slug = ?').get(d.business.slug)) continue;
  db.transaction(() => {
    const cols = Object.keys(d.business);
    const bid = db
      .prepare(`INSERT INTO businesses (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map((c) => d.business[c])).lastInsertRowid;
    setServices(bid, d.services);
    const adminId = db
      .prepare(`INSERT INTO users (business_id, name, email, password_hash, role, position) VALUES (?,?,?,?,'admin','Administrador')`)
      .run(bid, d.admin[0], d.admin[1], hash('admin123')).lastInsertRowid;
    db.prepare(`INSERT INTO users (business_id, name, email, password_hash, role, position) VALUES (?,?,?,?,'colaborador',?)`)
      .run(bid, d.collaborator[0], d.collaborator[1], hash('colab123'), d.collaborator[2]);
    for (const [name, category, price, cost, stock, description] of d.products) {
      const pid = db
        .prepare(`INSERT INTO products (business_id, name, category, price, cost, stock, min_stock, description) VALUES (?,?,?,?,?,?,5,?)`)
        .run(bid, name, category, price, cost, stock, description).lastInsertRowid;
      db.prepare(`INSERT INTO inventory_movements (business_id, product_id, user_id, type, quantity, stock_after, reason) VALUES (?,?,?,'entrada',?,?,'Stock inicial')`)
        .run(bid, pid, adminId, stock, stock);
    }
    for (const [title, content] of d.ads) db.prepare('INSERT INTO ads (business_id, title, content) VALUES (?,?,?)').run(bid, title, content);
    db.prepare('INSERT INTO clients (business_id, name, document, phone, email) VALUES (?,?,?,?,?)')
      .run(bid, 'Cliente de prueba', '1020304050', '3009998877', 'cliente@correo.com');
  })();
  console.log(`Negocio demo creado: ${d.business.name}`);
}

console.log(`
Usuarios de prueba:
  Superadmin:   super@plataforma.com / super123
  Café Aroma:   admin@cafearoma.co / admin123   ·  andres@cafearoma.co / colab123
  TecnoFix:     admin@tecnofix.co / admin123    ·  sofia@tecnofix.co / colab123
`);
