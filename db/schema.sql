CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0
);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image TEXT;

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price INTEGER,
  image TEXT,
  description TEXT,
  is_hot INTEGER DEFAULT 0,
  is_new INTEGER DEFAULT 0,
  is_export INTEGER DEFAULT 0,
  stock INTEGER DEFAULT 100,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
UPDATE products SET sort_order = id WHERE sort_order = 0;

-- Thứ tự hiển thị riêng cho từng nhãn (HOT / mới / xuất khẩu), độc lập với
-- sort_order dùng cho trang danh mục, để trang quản trị có thể sắp xếp lên
-- xuống riêng trong từng nhãn.
ALTER TABLE products ADD COLUMN IF NOT EXISTS hot_order INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS new_order INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS export_order INTEGER DEFAULT 0;
UPDATE products SET hot_order = sort_order WHERE hot_order = 0 AND is_hot = 1;
UPDATE products SET new_order = sort_order WHERE new_order = 0 AND is_new = 1;
UPDATE products SET export_order = sort_order WHERE export_order = 0 AND is_export = 1;

CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  image TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  thumbnail TEXT,
  summary TEXT,
  content TEXT,
  is_featured INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_shared_guest INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_pending INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  note TEXT,
  total INTEGER NOT NULL,
  status TEXT DEFAULT 'moi',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  product_id INTEGER,
  product_name TEXT,
  price INTEGER,
  qty INTEGER
);

-- Một dòng duy nhất lưu số lượt truy cập, để không bị reset về 0 mỗi khi
-- Render deploy lại (biến đếm trong RAM trước đây bị mất lúc restart server).
CREATE TABLE IF NOT EXISTS site_stats (
  id INTEGER PRIMARY KEY,
  visit_count INTEGER NOT NULL DEFAULT 0
);
INSERT INTO site_stats (id, visit_count) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
