const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

const xpDbPath = './database/xp.json';

function readDB(dbPath) {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

const XP_TO_LEVEL_UP = (level) => Math.floor(100 * Math.pow(level + 1, 1.8));

module.exports = {
    name: 'leaderboard',
    description: 'Melihat top 10 user dengan XP tertinggi di server ini',

    async execute(message, args, client) {

        const guildId = message.guild.id;
        let xpDb = readDB(xpDbPath);

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

            return message.reply(
                '📊 Belum ada data XP di server ini. Mulai ngobrol untuk dapatkan XP!'
            );

        }

        serverUsers.sort((a, b) => b.level - a.level || b.xp - a.xp);

        const top10 = serverUsers.slice(0, 10);

        const loadingMsg = await message.reply("⏳ Menyiapkan Leaderboard...");

        const usersData = await Promise.all(
            top10.map(async (userData) => {

                let username = "Unknown";
                let avatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png";

                try {

                    const user = await client.users.fetch(userData.userId);

                    username = user.username;

                    avatarUrl = user.displayAvatarURL({
                        extension: "png",
                        size: 128
                    });

                } catch {}

                return { ...userData, username, avatarUrl };

            })
        );

        try {

            const rowHeight = 90;
            const canvasHeight = usersData.length * rowHeight + 40;

            const canvas = createCanvas(700, canvasHeight);
            const ctx = canvas.getContext("2d");

            ctx.fillStyle = "#1e2128";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            let y = 20;

            for (let i = 0; i < usersData.length; i++) {

                const user = usersData[i];

                ctx.fillStyle = "#23272f";
                ctx.fillRect(20, y, 660, 70);

                const avatar = await loadImage(user.avatarUrl);

                ctx.drawImage(avatar, 35, y + 10, 50, 50);

                let rankColor = "#ffffff";

                if (i === 0) rankColor = "#f97316";
                if (i === 1) rankColor = "#fb923c";
                if (i === 2) rankColor = "#fdba74";

                ctx.font = "bold 26px sans-serif";
                ctx.fillStyle = rankColor;
                ctx.fillText(`#${i + 1}`, 100, y + 40);

                ctx.font = "bold 22px sans-serif";
                ctx.fillStyle = "#f1f5f9";
                ctx.fillText(user.username, 160, y + 35);

                ctx.font = "18px sans-serif";
                ctx.fillStyle = "#cbd5e1";
                ctx.fillText(`LVL ${user.level}`, 160, y + 60);

                const needed = XP_TO_LEVEL_UP(user.level);

                const progressPercent = Math.min(
                    Math.round((user.xp / needed) * 100),
                    100
                );

                ctx.fillStyle = "#3a3f4b";
                ctx.fillRect(300, y + 48, 340, 8);

                ctx.fillStyle = "#22d3ee";
                ctx.fillRect(
                    300,
                    y + 48,
                    (340 * progressPercent) / 100,
                    8
                );

                y += rowHeight;

            }

            const buffer = await canvas.encode("png");

            const attachment = new AttachmentBuilder(buffer, {
                name: "leaderboard.png"
            });

            await message.channel.send({
                files: [attachment]
            });

            await loadingMsg.delete();

        } catch (error) {

            console.error("Gagal merender Leaderboard:", error);

            loadingMsg.edit("❌ Gagal memuat Leaderboard.");

        }

    }
};
