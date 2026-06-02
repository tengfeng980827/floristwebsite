const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("Missing SUPABASE_URL or SUPABASE key in Railway Variables.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Frontend routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Products
app.get("/api/products", async (req, res) => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get("/api/admin/products", async (req, res) => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post("/api/admin/products", async (req, res) => {
  const { name, category, description, price, image_url, is_active } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: "Product name and price are required." });
  }

  const { data, error } = await supabase
    .from("products")
    .insert([{
      name,
      category,
      description,
      price: Number(price),
      image_url,
      is_active: is_active !== false
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put("/api/admin/products/:id", async (req, res) => {
  const id = req.params.id;
  const { name, category, description, price, image_url, is_active } = req.body;

  const { data, error } = await supabase
    .from("products")
    .update({
      name,
      category,
      description,
      price: Number(price),
      image_url,
      is_active
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete("/api/admin/products/:id", async (req, res) => {
  const id = req.params.id;

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Orders
app.post("/api/orders", async (req, res) => {
  const {
    customer_name,
    phone,
    address,
    delivery_date,
    delivery_time,
    card_message,
    payment_method,
    items
  } = req.body;

  if (!customer_name || !phone || !address || !items || !items.length) {
    return res.status(400).json({ error: "Missing order details." });
  }

  const total = items.reduce((sum, item) => {
    return sum + Number(item.price) * Number(item.qty);
  }, 0);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert([{
      customer_name,
      phone,
      address,
      delivery_date,
      delivery_time,
      card_message,
      total,
      payment_method,
      payment_status: "pending",
      order_status: "new"
    }])
    .select()
    .single();

  if (orderError) return res.status(500).json({ error: orderError.message });

  const orderItems = items.map(item => ({
    order_id: order.id,
    product_name: item.name,
    qty: item.qty,
    price: item.price
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) return res.status(500).json({ error: itemsError.message });

  res.json({
    success: true,
    order_id: order.id,
    total
  });
});

app.get("/api/admin/orders", async (req, res) => {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .order("id", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const orderIds = (orders || []).map(o => o.id);

  let items = [];
  if (orderIds.length) {
    const result = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);

    if (result.error) return res.status(500).json({ error: result.error.message });
    items = result.data || [];
  }

  const finalOrders = (orders || []).map(order => ({
    ...order,
    items: items.filter(item => item.order_id === order.id)
  }));

  res.json(finalOrders);
});

app.put("/api/admin/orders/:id/status", async (req, res) => {
  const id = req.params.id;
  const { order_status, payment_status } = req.body;

  const payload = {};
  if (order_status) payload.order_status = order_status;
  if (payment_status) payload.payment_status = payment_status;

  const { data, error } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/api/admin/stats", async (req, res) => {
  const { data: products } = await supabase.from("products").select("id");
  const { data: orders } = await supabase.from("orders").select("id,total,payment_status,order_status");

  const totalSales = (orders || []).reduce((sum, o) => sum + Number(o.total || 0), 0);
  const pendingOrders = (orders || []).filter(o => o.order_status === "new" || o.order_status === "preparing").length;

  res.json({
    totalProducts: products?.length || 0,
    totalOrders: orders?.length || 0,
    totalSales,
    pendingOrders
  });
});

app.listen(PORT, () => {
  console.log(`Florist e-commerce running on port ${PORT}`);
});
