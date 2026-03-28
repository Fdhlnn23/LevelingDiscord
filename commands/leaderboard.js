const { AttachmentBuilder } = require('discord.js');
const nodeHtmlToImage = require('node-html-to-image');
const fs = require('fs');
const crypto = require('crypto');

const xpDbPath = './database/xp.json';

function readDB(dbPath) { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); }

// Harus sama persis dengan rumus di index.js
const XP_TO_LEVEL_UP = (level) => Math.floor(100 * Math.pow(level + 1, 1.8));

module.exports = {
    name: 'leaderboard',
    description: 'Melihat top 10 user dengan XP tertinggi di server ini',
    async execute(message, args, client) {
        const guildId = message.guild.id;
        let xpDb = readDB(xpDbPath);

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

        // 2. Urutkan by Level dulu, lalu XP
        serverUsers.sort((a, b) => b.level - a.level || b.xp - a.xp);
        const top10 = serverUsers.slice(0, 10);

        const loadingMsg = await message.reply("⏳ Menyiapkan Leaderboard, mohon tunggu...");

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

        // 4. Build HTML rows
        let rowsHtml = '';
        for (let i = 0; i < usersData.length; i++) {
            const { username, avatarUrl, level, xp } = usersData[i];
            const rankColor = i < 3 ? '#f97316' : '#ffffff';
            const needed = XP_TO_LEVEL_UP(level);
            const progressPercent = Math.min(Math.round((xp / needed) * 100), 100);
            const separator = i > 0 ? `<div class="separator"></div>` : '';

            rowsHtml += `
            ${separator}
            <div class="row">
                <img src="${avatarUrl}" class="avatar" />
                <div class="info">
                    <div class="top-line">
                        <span class="rank" style="color: ${rankColor};">#${i + 1}</span>
                        <span class="dot">•</span>
                        <span class="username">@${username}</span>
                        <span class="dot">•</span>
                        <span class="lvl">LVL: ${level}</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-bar" style="width: ${progressPercent}%;"></div>
                    </div>
                </div>
            </div>
            `;
        }

        const htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;900&display=swap');
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { width: 680px; background: #1e2128; font-family: 'Inter', 'Segoe UI', sans-serif; }
                .row { display: flex; align-items: center; padding: 14px 20px; background: #23272f; gap: 16px; }
                .separator { height: 1px; background: #2e333d; }
                .avatar { width: 64px; height: 64px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
                .info { flex: 1; display: flex; flex-direction: column; gap: 8px; }
                .top-line { display: flex; align-items: center; gap: 10px; }
                .rank { font-size: 26px; font-weight: 900; min-width: 48px; }
                .dot { color: #6b7280; font-size: 20px; font-weight: 700; }
                .username { color: #f1f5f9; font-size: 24px; font-weight: 700; }
                .lvl { color: #f1f5f9; font-size: 24px; font-weight: 700; }
                .progress-track { width: 100%; height: 4px; background: #3a3f4b; border-radius: 2px; overflow: hidden; }
                .progress-bar { height: 100%; background: linear-gradient(90deg, #22d3ee, #0ea5e9); border-radius: 2px; }
            </style>
        </head>
        <body>${rowsHtml}</body>
        </html>
        `;

        try {
            const totalHeight = usersData.length * 93;
            const imageBuffer = await nodeHtmlToImage({
                html: htmlTemplate,
                transparent: false,
                puppeteerArgs: { defaultViewport: { width: 680, height: totalHeight } }
            });

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
            console.error("Gagal merender Leaderboard:", error);
            loadingMsg.edit("❌ Gagal memuat Leaderboard karena error saat merender gambar.");
        }
    }
};