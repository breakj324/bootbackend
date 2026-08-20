const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const BOT_TOKEN = '8687904267:AAGZHiUw0x6T3Gen3DIOmxC-q9YKhLvVobo';
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId, text) {
  try {
    const res = await fetch(`${API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await res.json();
    console.log(`[BOT -> Telegram ${chatId}]:`, data.ok ? 'Sent successfully' : data);
    return data;
  } catch (e) {
    console.error('Error sending message:', e);
  }
}

async function sendPhotoFile(chatId, filePath, caption) {
  try {
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer], { type: 'image/png' });
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', blob, 'example-screenshot.png');
      if (caption) formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');

      const res = await fetch(`${API_URL}/sendPhoto`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      console.log(`[BOT Photo File -> Telegram ${chatId}]:`, data.ok ? 'Sent image file successfully!' : data);
      if (data.ok) return data;
    }
  } catch (e) {
    console.error('Error uploading photo file:', e);
  }
  // Fallback to sending text if photo upload fails
  return await sendMessage(chatId, caption);
}

async function handleUpdate(update) {
  if (!update?.message || !update?.message?.chat) return;

  const chatId = String(update.message.chat.id);
  const text = update.message.text ? update.message.text.trim() : (update.message.caption ? update.message.caption.trim() : '');
  const username = update.message.chat.username || null;
  const firstName = update.message.chat.first_name || '';
  const lastName = update.message.chat.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim() || 'Joueur';
  const hasPhoto = !!(update.message.photo && update.message.photo.length > 0) || !!update.message.document;

  console.log(`\n📩 Incoming Telegram message from ${fullName} (ID: ${chatId}): "${text}" (photo: ${hasPhoto})`);

  // Active campaign order
  const activeOrder = await prisma.order.findFirst({
    where: { status: 'ACTIVE', promoCode: { isActive: true } },
    orderBy: { createdAt: 'desc' },
    include: { promoCode: true },
  });

  if (!activeOrder) {
    await sendMessage(chatId, `ℹ️ <b>مرحباً بك ${fullName}!</b>\n\nحالياً ماكاين حتى شي عرض ديال البونص.`);
    return;
  }

  // Conversation state
  let convState = await prisma.telegramConversationState.findUnique({ where: { telegramChatId: chatId } });
  if (!convState) {
    convState = await prisma.telegramConversationState.create({ data: { telegramChatId: chatId, step: 'IDLE' } });
  }

  if (convState.step === 'AWAITING_BOOKMAKER_ID' && text !== '/start' && !hasPhoto) {
    const isTenDigits = /^\d{10}$/.test(text);
    if (!isTenDigits) {
      console.log(`❌ Invalid 10-digit ID submitted: "${text}"`);
      await sendMessage(chatId, `⚠️ <b>الأيدي غير صحيح !</b>\n\nالأيدي (ID) خاصو يكون كيتكون من 10 ديال الأرقام بالضبط (مثال: 1770795503). عاود صيفط الرقم الصحيح من فضلك.`);
      return;
    }

    const existingId = await prisma.playerClaim.findFirst({ where: { playerBookmakerId: text } });
    if (existingId) {
      console.log(`❌ ID already used in DB: "${text}"`);
      await sendMessage(chatId, `❌ <b>الأيدي مستعمل ديجا !</b>\n\nهاد الأيدي (ID) <code>${text}</code> ديجا تسجل فالعرض. مايمكنش ليك تعاود تستعمل نفس الأيدي.`);
      return;
    }

    await prisma.telegramConversationState.update({
      where: { telegramChatId: chatId },
      data: { step: 'AWAITING_SCREENSHOT', metadata: JSON.stringify({ playerBookmakerId: text }) },
    });

    const caption = `💬 <b>خطوة أخيرة ومهمة!</b>\n\nشكراً، الأيدي ديالك هو <code>${text}</code>.\n\nدابا، <b>صيفط ليا سكرين شوت (صورة الشاشة)</b> ديال الحساب ديالك اللي تسجلتي بيه فين كايظهر الأيدي والكود برومو <code>${activeOrder.promoCode.code}</code> باش نأكدو التسجيل ديالك ونفعلوا ليك البونص. 📸`;
    const imagePath = path.join(__dirname, 'claims', 'example-screenshot.png');
    await sendPhotoFile(chatId, imagePath, caption);

  } else if (convState.step === 'AWAITING_SCREENSHOT' && text !== '/start') {
    if (!hasPhoto) {
      console.log(`⚠️ User sent text instead of photo when photo was expected`);
      await sendMessage(chatId, `⚠️ <b>عافاك صيفط صورة (Screenshot) !</b>\n\nصيفط ليا سكرين شوت ديال التسجيل دابا من فضلك.`);
      return;
    }

    let playerBookmakerId = 'INCONNU';
    try {
      if (convState.metadata) {
        playerBookmakerId = JSON.parse(convState.metadata).playerBookmakerId || 'INCONNU';
      }
    } catch (e) {}

    await prisma.playerClaim.create({
      data: {
        telegramChatId: chatId,
        telegramUsername: username,
        telegramName: fullName,
        promoCodeId: activeOrder.promoCodeId,
        orderId: activeOrder.id,
        playerBookmakerId,
        screenshotUrl: 'telegram_live_photo',
        status: 'PENDING',
      },
    });

    await prisma.order.update({
      where: { id: activeOrder.id },
      data: { claimedCount: { increment: 1 } },
    });

    await prisma.telegramConversationState.update({
      where: { telegramChatId: chatId },
      data: { step: 'IDLE', metadata: null },
    });

    console.log(`✅ Claim successfully created in SQLite DB for ${fullName} (${playerBookmakerId})`);
    await sendMessage(chatId, `✅ <b>تم تسجيل الطلب بنجاح!</b>\n\nشكراً ليك! غادي نراجعو الأيدي والسكرين شوت ديالك وغادي نجاوبوك هنا ف أقرب وقت فاش يتفعل البونص ديالك. 🚀`);

  } else {
    await prisma.telegramConversationState.upsert({
      where: { telegramChatId: chatId },
      create: { telegramChatId: chatId, step: 'AWAITING_BOOKMAKER_ID', currentOrderId: activeOrder.id },
      update: { step: 'AWAITING_BOOKMAKER_ID', currentOrderId: activeOrder.id, metadata: null },
    });

    const msg = `🎁 <b>عرض البونص والتسجيل - ${activeOrder.promoCode.bookmaker.toUpperCase()}</b>\n\n` +
      `مرحباً بك <b>${fullName}</b>!\n` +
      `باش تستافد من البونص والديبو فابور ديالنا، تبع هاد الخطوات البسيطة:\n\n` +
      `1️⃣ تسجل فـ <b>${activeOrder.promoCode.bookmaker}</b>\n` +
      `2️⃣ دير الكود برومو (Code Promo) الضروري: <code>${activeOrder.promoCode.code}</code>\n` +
      `3️⃣ <b>الشروط المطلوبة :</b> ${activeOrder.freeDepositConditions}\n\n` +
      `👉 <b>صيفط ليا دابا الأيدي (ID)</b> ديال الحساب ديالك اللي تسجلتي بيه فـ ${activeOrder.promoCode.bookmaker} باش نتحققوا منو.`;

    await sendMessage(chatId, msg);
  }
}

let offset = 0;
async function startLiveBot() {
  console.log('🚀 LIVE Telegram Bot is NOW active and sending real binary tutorial images...');
  while (true) {
    try {
      const res = await fetch(`${API_URL}/getUpdates?offset=${offset}&timeout=5`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }
      }
    } catch (e) {
      console.error('Polling error:', e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

startLiveBot();
