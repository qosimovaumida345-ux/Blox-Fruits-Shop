const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// Telegram ma'lumotlaringiz
const BOT_TOKEN = '8689663085:AAEtRKVPpqOMgjhV1L0rdMDArSSkUpnrafU';
const ADMIN_ID = '8572227182';

let kutilayotganXaridor = null; 

app.post('/api/buyurtma', (req, res) => {
    const { robloxNik, meva } = req.body;
    kutilayotganXaridor = { robloxNik, meva };
    console.log(`🛒 Saytda buyurtma: ${robloxNik} (${meva})`);
    res.status(200).send({ success: true });
});

// Paynet ham qo'shilgan ro'yxat
const ishonchliRaqamlar = ['8888', 'click', 'payme', 'uzum', 'paynet', 'nbu', 'cardinfo', 'uzcard', 'humo', 'sms-inform'];

app.post('/api/tolov', (req, res) => {
    console.log("📨 SMS KELDI! Ma'lumot:", req.body); // Nima kelganini ko'ramiz

    const { sender, message } = req.body;
    const yuboruvchi = sender ? sender.toString().toLowerCase() : "";
    const smsMatn = message ? message.toLowerCase() : "";

    console.log(`🔍 Tekshirilmoqda: Kimdan: ${yuboruvchi}, Matn: ${smsMatn}`);

    if (ishonchliRaqamlar.includes(yuboruvchi) && (smsMatn.includes('kirim') || smsMatn.includes('tushdi') || smsMatn.includes("to'lov o'tdi") || smsMatn.includes("tolov otdi") || smsMatn.includes("qabul qilindi"))) {
        console.log("✅ SMS ishonchli manbadan va to'lov so'zlari bor.");
        
        const summaUshlagich = smsMatn.match(/(\d[\d\s]*)(so'm|uzs|sum)/i);
        
        if (summaUshlagich) {
            const tushganPul = summaUshlagich[1].replace(/\s/g, ''); 
            console.log(`💰 Pul aniqlandi: ${tushganPul}`);
            
            let text = `✅ <b>YANGI TO'LOV TASDIQLANDI!</b>\n💰 <b>Summa:</b> ${tushganPul} so'm\n`;
            if (kutilayotganXaridor) {
                text += `👤 <b>Nik:</b> ${kutilayotganXaridor.robloxNik}\n🛍 <b>Xarid:</b> ${kutilayotganXaridor.meva}`;
                kutilayotganXaridor = null; 
            } else {
                text += `⚠️ Mijoz niki topilmadi (saytdan buyurtma berilmagan).`;
            }

            const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${ADMIN_ID}&parse_mode=HTML&text=${encodeURIComponent(text)}`;
            
            fetch(url)
                .then(r => r.json())
                .then(data => console.log("📲 Telegramga yuborildi. Holati:", data.ok))
                .catch(err => console.log("❌ Bot xatosi:", err));
        } else {
            console.log("❌ XATO: Summa topilmadi. Matn formulaga tushmadi.");
        }
    } else {
        console.log("❌ XATO: SMS talablarga javob bermadi (Noma'lum raqam yoki matn).");
    }
    res.status(200).send({ success: true });
});

app.listen(3000, () => console.log('🚀 Server 3000-portda va botga ulangan!'));
