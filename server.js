const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// Sizning ma'lumotlaringiz asosida sozlangan
const BOT_TOKEN = '8689663085:AAEtRKVPpqOMgjhV1L0rdMDArSSkUpnrafU';
const ADMIN_ID = '8572227182';

let kutilayotganXaridor = null; 

// 1. Saytdan buyurtmani qabul qilish
app.post('/api/buyurtma', (req, res) => {
    const { robloxNik, meva } = req.body;
    kutilayotganXaridor = { robloxNik, meva };
    console.log(`🛒 Saytda buyurtma: ${robloxNik} (${meva})`);
    res.status(200).send({ success: true });
});

// 2. Telefonda SMS kelganda ishlovchi qism
const ishonchliRaqamlar = ['8888', 'Click', 'payme', 'Uzum', 'NBU', 'CARDINFO', 'Paynet', 'Uzcard', 'Humo', 'sms-inform'];

app.post('/api/tolov', (req, res) => {
    const { sender, message } = req.body;
    const yuboruvchi = sender ? sender.toString().toLowerCase() : "";
    const smsMatn = message ? message.toLowerCase() : "";

   if (ishonchliRaqamlar.includes(yuboruvchi) && (smsMatn.includes('kirim') || smsMatn.includes('tushdi') || smsMatn.includes("to'lov o'tdi") || smsMatn.includes("tolov otdi") || smsMatn.includes("qabul qilindi"))) {
        const summaUshlagich = smsMatn.match(/(\d[\d\s]*)(so'm|uzs|sum)/i);
        
        if (summaUshlagich) {
            const tushganPul = summaUshlagich[1].replace(/\s/g, ''); 
            
            let text = `✅ <b>YANGI TO'LOV TASDIQLANDI!</b>\n💰 <b>Summa:</b> ${tushganPul} so'm\n`;
            if (kutilayotganXaridor) {
                text += `👤 <b>Nik:</b> ${kutilayotganXaridor.robloxNik}\n🛍 <b>Xarid:</b> ${kutilayotganXaridor.meva}`;
                kutilayotganXaridor = null; 
            }

            const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${ADMIN_ID}&parse_mode=HTML&text=${encodeURIComponent(text)}`;
            fetch(url).catch(err => console.log("Bot xatosi:", err));
        }
    }
    res.status(200).send({ success: true });
});


app.listen(3000, () => console.log('🚀 Server 3000-portda va botga ulangan!'));
