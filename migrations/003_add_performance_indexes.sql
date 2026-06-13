-- Justification: Speeds up order history lookups by user.
CREATE INDEX IF NOT EXISTS idx_orders_user_id
ON orders(user_id);

-- Justification: Supports ordering user history by newest orders first.
CREATE INDEX IF NOT EXISTS idx_orders_user_date
ON orders(user_id, order_date DESC);

-- Justification: Speeds up joins between orders and order_items.
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
ON order_items(order_id);

-- Justification: Speeds up menu item lookups during order aggregation.
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item
ON order_items(menu_item_id);

-- Justification: Speeds up restaurant menu retrieval.
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant
ON menu_items(restaurant_id);

-- Justification: Speeds up category joins from menu items.
CREATE INDEX IF NOT EXISTS idx_menu_items_category
ON menu_items(category_id);

-- Justification: Speeds up city filtering on restaurant listing.
CREATE INDEX IF NOT EXISTS idx_restaurants_city
ON restaurants(city);