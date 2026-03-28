const { AttachmentBuilder } = require('discord.js');
const nodeHtmlToImage = require('node-html-to-image');
const fs = require('fs');

const xpDbPath = './database/xp.json';

function readDB(dbPath) { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); }

// Harus sama persis dengan rumus di index.js
const XP_TO_LEVEL_UP = (level) => Math.floor(100 * Math.pow(level + 1, 1.8));

module.exports = {
    name: 'rank',
    description: 'Mengecek level dan rank card',
    async execute(message, args, client) {
        const guildId = message.guild.id;
        const targetUser = message.mentions.users.first() || message.author;
        const targetDbKey = `${guildId}_${targetUser.id}`;

        let xpDb = readDB(xpDbPath);
        const userData = xpDb[targetDbKey] || { xp: 0, level: 0 };

        const currentLevel = userData.level;
        const currentXp = userData.xp;
        const xpNeeded = XP_TO_LEVEL_UP(currentLevel);
        const progressPercentage = Math.min(Math.max((currentXp / xpNeeded) * 100, 0), 100);

        const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
        const bgUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop';

        const htmlRankCard = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { width: 900px; height: 300px; margin: 0; font-family: 'Segoe UI', sans-serif; background-image: url('${bgUrl}'); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; }
                .card { background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 24px; padding: 40px; display: flex; align-items: center; width: 85%; height: 65%; box-shadow: 0 10px 40px 0 rgba(0, 0, 0, 0.5); }
                .avatar { width: 150px; height: 150px; border-radius: 50%; border: 5px solid #818cf8; object-fit: cover; box-shadow: 0 0 20px rgba(129, 140, 248, 0.4); }
                .info { margin-left: 40px; flex-grow: 1; color: white; }
                .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; }
                .name { font-size: 46px; font-weight: 800; margin: 0; color: #f8fafc; }
                .level-info { text-align: right; }
                .level-text { font-size: 20px; color: #94a3b8; font-weight: 600; }
                .level-num { font-size: 48px; font-weight: 900; color: #818cf8; line-height: 0.8; }
                .xp-info { display: flex; justify-content: flex-end; font-size: 18px; color: #cbd5e1; margin-bottom: 8px; font-weight: 500; }
                .xp-info span { color: #818cf8; font-weight: bold; margin-right: 5px; }
                .progress-bar-container { width: 100%; height: 24px; background: rgba(0, 0, 0, 0.4); border-radius: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.05); }
                .progress-fill { height: 100%; width: ${progressPercentage}%; background: linear-gradient(90deg, #38bdf8, #818cf8); border-radius: 12px; box-shadow: 0 0 10px rgba(56, 189, 248, 0.5); }
            </style>
        </head>
        <body>
            <div class="card">
                <img src="${avatarUrl}" class="avatar" />
                <div class="info">
                    <div class="header">
                        <div class="name">@${targetUser.username}</div>
                        <div class="level-info">
                            <div class="level-text">LEVEL</div>
                            <div class="level-num">${currentLevel}</div>
                        </div>
                    </div>
                    <div class="xp-info"><span>${currentXp.toLocaleString()}</span> / ${xpNeeded.toLocaleString()} XP</div>
                    <div class="progress-bar-container"><div class="progress-fill"></div></div>
                </div>
            </div>
        </body>
        </html>
        `;

        const loadingMsg = await message.reply("⏳ Memuat Rank Card...");
        try {
            const imageBuffer = await nodeHtmlToImage({ html: htmlRankCard, transparent: true });
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'rankcard.png' });
            await message.channel.send({ files: [attachment] });
            await loadingMsg.delete();
        } catch (error) {
            console.error("Gagal render Rank Card:", error);
            loadingMsg.edit("❌ Gagal memuat Rank Card.");
        }
    }
};