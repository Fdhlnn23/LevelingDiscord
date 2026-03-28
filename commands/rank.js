const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

const xpDbPath = './database/xp.json';

function readDB(dbPath) { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); }

const XP_TO_LEVEL_UP = (level) => Math.floor(100 * Math.pow(level + 1, 1.8));

// ==========================================
// HELPER: Rounded rectangle path
// ==========================================
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ==========================================
// RENDER RANK CARD (Canvas)
// Mirip desain HTML: card glass, avatar border ungu,
// progress bar gradient biru-ungu, info kanan
// ==========================================
async function renderRankCard(targetUser, userData) {
    const W = 900, H = 300;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // --- Background gradient ---
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.4, '#1e1b4b');
    bgGrad.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Dekoratif background: titik cahaya acak
    for (let i = 0; i < 60; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`;
        ctx.fill();
    }

    // --- Card glass ---
    const cardX = 40, cardY = 42, cardW = 820, cardH = 216, cardR = 24;
    ctx.save();
    roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // --- Avatar ---
    const avatarSize = 150;
    const avatarCX = cardX + 45 + avatarSize / 2;
    const avatarCY = cardY + cardH / 2;
    const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });

    try {
        const avatarImg = await loadImage(avatarUrl);

        // Glow shadow
        ctx.save();
        ctx.shadowColor = 'rgba(129,140,248,0.4)';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(avatarCX, avatarCY, avatarSize / 2 + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#818cf8';
        ctx.fill();
        ctx.restore();

        // Clip & gambar avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarCX, avatarCY, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, avatarCX - avatarSize / 2, avatarCY - avatarSize / 2, avatarSize, avatarSize);
        ctx.restore();
    } catch (e) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarCX, avatarCY, avatarSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#334155';
        ctx.fill();
        ctx.restore();
    }

    // --- Area info (kanan avatar) ---
    const infoX = avatarCX + avatarSize / 2 + 40;
    const infoW = cardX + cardW - infoX - 30;

    // Level info (pojok kanan atas card)
    const currentLevel = userData.level;
    const levelLabelX = cardX + cardW - 30;
    const levelLabelY = cardY + 55;

    ctx.textAlign = 'right';
    ctx.font = 'bold 18px "Segoe UI", Arial';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('LEVEL', levelLabelX, levelLabelY);

    ctx.font = 'bold 52px "Segoe UI", Arial';
    ctx.fillStyle = '#818cf8';
    ctx.fillText(`${currentLevel}`, levelLabelX, levelLabelY + 52);

    // Username
    ctx.textAlign = 'left';
    ctx.font = 'bold 44px "Segoe UI", Arial';
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText(`@${targetUser.username}`, infoX, cardY + 105);
    ctx.shadowBlur = 0;

    // XP info
    const currentXp = userData.xp;
    const xpNeeded = XP_TO_LEVEL_UP(currentLevel);
    ctx.textAlign = 'right';
    ctx.font = 'bold 17px "Segoe UI", Arial';
    ctx.fillStyle = '#818cf8';
    ctx.fillText(`${currentXp.toLocaleString()}`, levelLabelX, cardY + 148);

    ctx.fillStyle = '#cbd5e1';
    const xpText = `${currentXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`;
    ctx.fillText(`/ ${xpNeeded.toLocaleString()} XP`, levelLabelX, cardY + 148);

    // Render XP label sepenuhnya
    ctx.textAlign = 'right';
    ctx.font = '17px "Segoe UI", Arial';
    ctx.fillStyle = '#cbd5e1';
    const fullXpLabel = `${currentXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`;
    ctx.fillText(fullXpLabel, levelLabelX, cardY + 150);

    // --- Progress bar ---
    const barX = infoX;
    const barY = cardY + 163;
    const barW = cardX + cardW - infoX - 30;
    const barH = 24;
    const barR = 12;
    const progressPercentage = Math.min(Math.max((currentXp / xpNeeded), 0), 1);

    // Track (background bar)
    ctx.save();
    roundRect(ctx, barX, barY, barW, barH, barR);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Fill bar (gradient)
    const fillW = Math.max(barR * 2, barW * progressPercentage);
    if (fillW > 0) {
        ctx.save();
        roundRect(ctx, barX, barY, fillW, barH, barR);
        const barGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
        barGrad.addColorStop(0, '#38bdf8');
        barGrad.addColorStop(1, '#818cf8');
        ctx.fillStyle = barGrad;

        // Glow efek
        ctx.shadowColor = 'rgba(56,189,248,0.5)';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
    }

    return canvas.toBuffer('image/png');
}

module.exports = {
    name: 'rank',
    description: 'Mengecek level dan rank card',
    async execute(message, args, client) {
        const guildId = message.guild.id;
        const targetUser = message.mentions.users.first() || message.author;
        const targetDbKey = `${guildId}_${targetUser.id}`;

        const xpDb = readDB(xpDbPath);
        const userData = xpDb[targetDbKey] || { xp: 0, level: 0 };

        const loadingMsg = await message.reply('⏳ Memuat Rank Card...');
        try {
            const imageBuffer = await renderRankCard(targetUser, userData);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'rankcard.png' });
            await message.channel.send({ files: [attachment] });
            await loadingMsg.delete();
        } catch (error) {
            console.error('Gagal render Rank Card:', error);
            loadingMsg.edit('❌ Gagal memuat Rank Card.');
        }
    }
};
