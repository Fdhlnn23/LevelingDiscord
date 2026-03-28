const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const crypto = require('crypto');

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
// RENDER LEADERBOARD (Canvas)
// Mirip desain HTML: list row dengan avatar kotak,
// rank berwarna, progress bar tipis
// ==========================================
async function renderLeaderboard(usersData) {
    const W = 680;
    const ROW_H = 93;      // tinggi per baris (sama dengan HTML)
    const SEP_H = 1;       // separator antar baris
    const H = usersData.length * ROW_H + (usersData.length - 1) * SEP_H;

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Background canvas: #1e2128
    ctx.fillStyle = '#1e2128';
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < usersData.length; i++) {
        const { username, avatarUrl, level, xp } = usersData[i];
        const yOffset = i * (ROW_H + SEP_H);

        // --- Row background: #23272f ---
        ctx.fillStyle = '#23272f';
        ctx.fillRect(0, yOffset, W, ROW_H);

        // --- Separator ---
        if (i > 0) {
            ctx.fillStyle = '#2e333d';
            ctx.fillRect(0, yOffset - SEP_H, W, SEP_H);
        }

        // --- Avatar (kotak rounded tipis) ---
        const avatarSize = 64;
        const avatarX = 20;
        const avatarY = yOffset + (ROW_H - avatarSize) / 2;

        try {
            const avatarImg = await loadImage(avatarUrl);
            ctx.save();
            roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 4);
            ctx.clip();
            ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();
        } catch (e) {
            ctx.save();
            roundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 4);
            ctx.fillStyle = '#334155';
            ctx.fill();
            ctx.restore();
        }

        // --- Info area ---
        const infoX = avatarX + avatarSize + 16;
        const infoW = W - infoX - 20;

        // Top line: #rank • @username • LVL: N
        // Rank color: oranye untuk top 3, putih lainnya
        const rankColor = i < 3 ? '#f97316' : '#ffffff';

        // Rank (#1, #2, dst)
        ctx.font = 'bold 26px "Segoe UI", Arial';
        ctx.fillStyle = rankColor;
        ctx.textAlign = 'left';
        const rankText = `#${i + 1}`;
        ctx.fillText(rankText, infoX, yOffset + 45);

        const rankW = ctx.measureText(rankText).width;

        // Separator dot
        ctx.font = 'bold 20px "Segoe UI", Arial';
        ctx.fillStyle = '#6b7280';
        ctx.fillText('•', infoX + rankW + 10, yOffset + 43);
        const dotW = ctx.measureText('•').width;

        // Username
        ctx.font = 'bold 24px "Segoe UI", Arial';
        ctx.fillStyle = '#f1f5f9';
        const usernameX = infoX + rankW + 10 + dotW + 10;
        ctx.fillText(`@${username}`, usernameX, yOffset + 45);
        const unameW = ctx.measureText(`@${username}`).width;

        // Dot 2
        ctx.font = 'bold 20px "Segoe UI", Arial';
        ctx.fillStyle = '#6b7280';
        ctx.fillText('•', usernameX + unameW + 10, yOffset + 43);
        const dot2W = ctx.measureText('•').width;

        // LVL
        ctx.font = 'bold 24px "Segoe UI", Arial';
        ctx.fillStyle = '#f1f5f9';
        ctx.fillText(`LVL: ${level}`, usernameX + unameW + 10 + dot2W + 10, yOffset + 45);

        // --- Progress bar ---
        const barX = infoX;
        const barY = yOffset + 62;
        const barW = infoW;
        const barH = 4;
        const barR = 2;

        const needed = XP_TO_LEVEL_UP(level);
        const progressPercent = Math.min((xp / needed), 1);

        // Track
        ctx.save();
        roundRect(ctx, barX, barY, barW, barH, barR);
        ctx.fillStyle = '#3a3f4b';
        ctx.fill();
        ctx.restore();

        // Fill
        const fillW = Math.max(barR * 2, barW * progressPercent);
        if (fillW > 0) {
            ctx.save();
            roundRect(ctx, barX, barY, fillW, barH, barR);
            const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
            grad.addColorStop(0, '#22d3ee');
            grad.addColorStop(1, '#0ea5e9');
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.restore();
        }
    }

    return canvas.toBuffer('image/png');
}

module.exports = {
    name: 'leaderboard',
    description: 'Melihat top 10 user dengan XP tertinggi di server ini',
    async execute(message, args, client) {
        const guildId = message.guild.id;
        const xpDb = readDB(xpDbPath);

        // 1. Filter data hanya untuk server ini
        const serverUsers = [];
        for (const key in xpDb) {
            if (key.startsWith(`${guildId}_`)) {
                const userId = key.split('_')[1];
                serverUsers.push({
                    userId,
                    xp: xpDb[key].xp,
                    level: xpDb[key].level
                });
            }
        }

        if (serverUsers.length === 0) {
            return message.reply('📊 Belum ada data XP di server ini. Mulai ngobrol untuk dapatkan XP!');
        }

        // 2. Sort by Level, lalu XP
        serverUsers.sort((a, b) => b.level - a.level || b.xp - a.xp);
        const top10 = serverUsers.slice(0, 10);

        const loadingMsg = await message.reply('⏳ Menyiapkan Leaderboard, mohon tunggu...');

        // 3. Fetch semua user secara paralel
        const usersData = await Promise.all(top10.map(async (userData) => {
            let username = 'Unknown User';
            let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
            try {
                const user = await client.users.fetch(userData.userId);
                username = user.username;
                avatarUrl = user.displayAvatarURL({ extension: 'png', size: 64 });
            } catch (e) {
                console.error(`User tidak ditemukan: ${userData.userId}`);
            }
            return { ...userData, username, avatarUrl };
        }));

        try {
            const imageBuffer = await renderLeaderboard(usersData);
            const fileName = `${crypto.randomBytes(16).toString('hex')}.png`;
            const attachment = new AttachmentBuilder(imageBuffer, { name: fileName });
            const serverName = message.guild.name;

            const components = [
                {
                    type: 17,
                    accent_color: null,
                    spoiler: false,
                    components: [
                        {
                            type: 9,
                            accessory: {
                                type: 2,
                                style: 5,
                                label: 'View Leaderboard',
                                emoji: null,
                                disabled: false,
                                url: `https://example.com/leaderboard/${guildId}`
                            },
                            components: [{ type: 10, content: `# ${serverName}` }]
                        },
                        {
                            type: 12,
                            items: [{ media: { url: `attachment://${fileName}` }, description: null, spoiler: false }]
                        }
                    ]
                }
            ];

            await message.channel.send({ files: [attachment], components, flags: 1 << 15 });
            await loadingMsg.delete();
        } catch (error) {
            console.error('Gagal merender Leaderboard:', error);
            loadingMsg.edit('❌ Gagal memuat Leaderboard karena error saat merender gambar.');
        }
    }
};
