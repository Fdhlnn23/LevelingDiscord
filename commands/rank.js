const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

const xpDbPath = './database/xp.json';

function readDB(dbPath) { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); }

const XP_TO_LEVEL_UP = (level) => Math.floor(100 * Math.pow(level + 1, 1.8));

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

async function renderRankCard(targetUser, userData) {
    const W = 900, H = 300;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // PENTING: selalu set textBaseline di awal
    ctx.textBaseline = 'alphabetic';

    // ── Background gradient ──
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0,   '#0f172a');
    bgGrad.addColorStop(0.5, '#1e1b4b');
    bgGrad.addColorStop(1,   '#0f0f1a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Partikel cahaya dekoratif
    for (let i = 0; i < 60; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(Math.random() * 0.2).toFixed(2)})`;
        ctx.fill();
    }

    // ── Card glass ──
    const cardX = 40, cardY = 42, cardW = 820, cardH = 216, cardR = 24;
    ctx.save();
    roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // ── Avatar ──
    const avatarSize = 150;
    const avatarCX = cardX + 50 + avatarSize / 2;
    const avatarCY = cardY + cardH / 2;
    const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });

    try {
        const avatarImg = await loadImage(avatarUrl);
        // Glow border
        ctx.save();
        ctx.shadowColor = 'rgba(129,140,248,0.45)';
        ctx.shadowBlur = 22;
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

    // ── Data XP ──
    const currentLevel = userData.level;
    const currentXp    = userData.xp;
    const xpNeeded     = XP_TO_LEVEL_UP(currentLevel);
    const progress     = Math.min(Math.max(currentXp / xpNeeded, 0), 1);

    const infoX  = avatarCX + avatarSize / 2 + 40;
    const rightX = cardX + cardW - 30;

    // Label "LEVEL"
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign  = 'right';
    ctx.font       = 'bold 18px sans-serif';
    ctx.fillStyle  = '#94a3b8';
    ctx.fillText('LEVEL', rightX, cardY + 65);

    // Angka level
    ctx.font      = 'bold 56px sans-serif';
    ctx.fillStyle = '#818cf8';
    ctx.fillText(`${currentLevel}`, rightX, cardY + 125);

    // Username
    ctx.textAlign   = 'left';
    ctx.font        = 'bold 44px sans-serif';
    ctx.fillStyle   = '#f8fafc';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur  = 8;
    ctx.fillText(`@${targetUser.username}`, infoX, cardY + 110);
    ctx.shadowBlur  = 0;

    // XP label
    ctx.textAlign  = 'right';
    ctx.font       = '18px sans-serif';
    ctx.fillStyle  = '#cbd5e1';
    ctx.fillText(`${currentXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, rightX, cardY + 153);

    // ── Progress bar ──
    const barX = infoX;
    const barY = cardY + 166;
    const barW = rightX - infoX;
    const barH = 24;
    const barR = 12;

    // Track
    ctx.save();
    roundRect(ctx, barX, barY, barW, barH, barR);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Fill
    const fillW = Math.max(barR * 2, barW * progress);
    ctx.save();
    roundRect(ctx, barX, barY, fillW, barH, barR);
    const barGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    barGrad.addColorStop(0, '#38bdf8');
    barGrad.addColorStop(1, '#818cf8');
    ctx.fillStyle = barGrad;
    ctx.shadowColor = 'rgba(56,189,248,0.5)';
    ctx.shadowBlur  = 12;
    ctx.fill();
    ctx.restore();

    return canvas.toBuffer('image/png');
}

module.exports = {
    name: 'rank',
    description: 'Mengecek level dan rank card',
    async execute(message, args, client) {
        const guildId    = message.guild.id;
        const targetUser = message.mentions.users.first() || message.author;
        const dbKey      = `${guildId}_${targetUser.id}`;

        const xpDb     = readDB(xpDbPath);
        const userData = xpDb[dbKey] || { xp: 0, level: 0 };

        const loadingMsg = await message.reply('⏳ Memuat Rank Card...');
        try {
            const imageBuffer = await renderRankCard(targetUser, userData);
            const attachment  = new AttachmentBuilder(imageBuffer, { name: 'rankcard.png' });
            await message.channel.send({ files: [attachment] });
            await loadingMsg.delete();
        } catch (error) {
            console.error('Gagal render Rank Card:', error);
            await loadingMsg.edit('❌ Gagal memuat Rank Card.');
        }
    }
};
