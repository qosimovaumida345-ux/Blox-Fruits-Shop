const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. TELEGRAM BOT VA KANAL SOZLAMALARI
// ==========================================
// Botingizning tokeni (oldingi kodingizdan olindi)
const BOT_TOKEN = '8689663085:AAEtRKVPpqOMgjhV1L0rdMDArSSkUpnrafU';
// Blox Fruits uchun maxsus kanal/gruppa ID si
const ADMIN_GROUP_ID = '-1003830831325'; 

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ==========================================
// 2. SUPABASE BAZASIGA ULANISH
// ==========================================
// Paroldagi "/" belgisi xavfsizlik uchun "%2F" ga almashtirildi
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.pkgewbdmisovwpccneho:abdulloh2011%2F@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

pool.connect((err, client, release) => {
    if (err) { console.error('❌ BAZAGA ULANISHDA XATO:', err.message); } 
    else { console.log('✅ BLOX FRUITS BAZASI BILAN ALOQA ZO\'R!'); release(); }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// 3. SESSIYA SOZLAMALARI
// ==========================================
app.use(session({
    store: new pgSession({ pool: pool, tableName: 'session' }),
    secret: 'blox_fruits_premium_secret',
    resave: false, saveUninitialized: false, cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// ==========================================
// 4. SAHIFALAR VA AVTORIZATSIYA
// ==========================================
app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/shop');
    res.render('login');
});

app.get('/shop', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    try {
        const user = await pool.query("SELECT * FROM blox_users WHERE id = $1", [req.session.userId]);
        res.render('dashboard', { user: user.rows[0] });
    } catch (err) { res.send("Xatolik yuz berdi"); }
});

app.post('/auth/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const check = await pool.query("SELECT * FROM blox_users WHERE username = $1", [username]);
        if (check.rows.length > 0) return res.status(400).json({ error: "Bu logindagi foydalanuvchi mavjud!" });
        const newUser = await pool.query("INSERT INTO blox_users (username, password) VALUES ($1, $2) RETURNING id", [username, password]);
        req.session.userId = newUser.rows[0].id;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Xatolik" }); }
});

app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await pool.query("SELECT * FROM blox_users WHERE username = $1 AND password = $2", [username, password]);
        if (user.rows.length > 0) { req.session.userId = user.rows[0].id; res.json({ success: true }); } 
        else { res.status(401).json({ error: "Login yoki parol xato!" }); }
    } catch (err) { res.status(500).json({ error: "Xatolik" }); }
});

app.get('/auth/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// ==========================================
// 5. TELEGRAM ULASH VA BUYURTMA BERISH
// ==========================================
app.post('/api/sync-telegram', async (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: "Login qiling" });
    const { tg_id, tg_username } = req.body;
    try {
        await pool.query("UPDATE blox_users SET tg_id = $1, tg_username = $2 WHERE id = $3", [tg_id, tg_username, req.session.userId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Bog'lashda xato" }); }
});

app.post('/api/buyurtma', async (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: "Avval tizimga kiring" });
    const { robloxNik, meva, price } = req.body;
    const itemPrice = parseInt(price.replace(/,/g, '')); // "25,000" ni 25000 ga aylantiradi

    try {
        const userRes = await pool.query("SELECT * FROM blox_users WHERE id = $1", [req.session.userId]);
        const user = userRes.rows[0];

        if (user.balance < itemPrice) {
            return res.status(400).json({ error: "Balansingiz yetarli emas! Karta orqali to'ldiring." });
        }

        // Balansni ayirish
        await pool.query("UPDATE blox_users SET balance = balance - $1 WHERE id = $2", [itemPrice, user.id]);
        
        // Buyurtmani bazaga yozish
        const newOrder = await pool.query(
            "INSERT INTO blox_orders (user_id, roblox_nik, item_name, price) VALUES ($1, $2, $3, $4) RETURNING id",
            [user.id, robloxNik, meva, itemPrice]
        );

        const orderId = newOrder.rows[0].id;

        // Adminga (Kanalga) xabar yuborish
        const text = `🚨 <b>YANGI XARID #${orderId} (BLOX FRUITS)</b>\n\n👤 Saytdagi mijoz: @${user.tg_username || user.username}\n🎮 Roblox Nik: <b>${robloxNik}</b>\n🛍 Mahsulot: ${meva}\n💰 Narxi: ${itemPrice} UZS\n\n✅ <i>To'lov sayt ichidagi balansdan yechib olindi!</i>`;
        
        bot.sendMessage(ADMIN_GROUP_ID, text, { parse_mode: 'HTML' });

        res.json({ success: true, orderId });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Xatolik yuz berdi" }); 
    }
});

// ==========================================
// 6. MACRODROID (SMS ORQALI TO'LOV)
// ==========================================
const ishonchliRaqamlar = ['8888', 'click', 'payme', 'uzum', 'paynet', 'nbu', 'cardinfo', 'uzcard', 'humo', 'sms-inform'];

app.post('/api/tolov', (req, res) => {
    const { sender, message } = req.body;
    const yuboruvchi = sender ? sender.toString().toLowerCase() : "";
    const smsMatn = message ? message.toLowerCase() : "";

    if (ishonchliRaqamlar.includes(yuboruvchi) && (smsMatn.includes('kirim') || smsMatn.includes('tushdi') || smsMatn.includes("to'lov o'tdi") || smsMatn.includes("qabul qilindi"))) {
        const summaUshlagich = smsMatn.match(/(\d[\d\s]*)(so'm|uzs|sum)/i);
        if (summaUshlagich) {
            const tushganPul = summaUshlagich[1].replace(/\s/g, ''); 
            
            // Kanalga SMS tushgani haqida xabar
            let text = `💳 <b>KARTAGA PUL TUSHDI (SMS)</b>\n💰 <b>Summa:</b> ${tushganPul} so'm\n\n<i>Mijozga balans qo'shish uchun Supabase'ga kirib 'blox_users' jadvalidan balansini oshiring.</i>`;
            bot.sendMessage(ADMIN_GROUP_ID, text, { parse_mode: 'HTML' });
        }
    }
    res.status(200).send({ success: true });
});

app.listen(PORT, () => console.log(`🚀 Blox Fruits Server ${PORT}-portda ishladi!`));
