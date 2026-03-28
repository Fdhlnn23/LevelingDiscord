const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

const xpDbPath = './database/xp.json';

function readDB(dbPath) {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

const XP_TO_LEVEL_UP = (level) => Math.floor(100 * Math.pow(level + 1, 1.8));

module.exports = {
    name: 'rank',
    description: 'Mengecek level dan rank card',

    async execute(message) {

        const guildId = message.guild.id;
        const targetUser = message.mentions.users.first() || message.author;

        const targetDbKey = `${guildId}_${targetUser.id}`;

        let xpDb = readDB(xpDbPath);
        const userData = xpDb[targetDbKey] || { xp: 0, level: 0 };

        const currentLevel = userData.level;
        const currentXp = userData.xp;
        const xpNeeded = XP_TO_LEVEL_UP(currentLevel);

        const progressPercentage = Math.min(
            Math.max((currentXp / xpNeeded) * 100, 0),
            100
        );

        const loadingMsg = await message.reply("⏳ Memuat Rank Card...");

        try {

            const canvas = createCanvas(900, 300);
            const ctx = canvas.getContext("2d");

            const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
            const bgUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop";

            const background = await loadImage(bgUrl);
            ctx.drawImage(background, 0, 0, 900, 300);

            // overlay
            ctx.fillStyle = "rgba(15,23,42,0.75)";
            ctx.fillRect(40, 40, 820, 220);

            // avatar
            const avatar = await loadImage(avatarUrl);

            ctx.save();
            ctx.beginPath();
            ctx.arc(140, 150, 75, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 65, 75, 150, 150);
            ctx.restore();

            // username
            ctx.font = "bold 46px sans-serif";
            ctx.fillStyle = "#f8fafc";
            ctx.fillText(`@${targetUser.username}`, 260, 130);

            // level text
            ctx.font = "20px sans-serif";
            ctx.fillStyle = "#94a3b8";
            ctx.fillText("LEVEL", 760, 90);

            ctx.font = "bold 48px sans-serif";
            ctx.fillStyle = "#818cf8";
            ctx.fillText(currentLevel, 760, 140);

            // xp text
            ctx.font = "18px sans-serif";
            ctx.fillStyle = "#cbd5e1";
            ctx.fillText(
                `${currentXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`,
                260,
                180
            );

            // progress bar background
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.fillRect(260, 200, 550, 24);

            // progress bar fill
            ctx.fillStyle = "#38bdf8";
            ctx.fillRect(260, 200, (550 * progressPercentage) / 100, 24);

            const buffer = await canvas.encode("png");

            const attachment = new AttachmentBuilder(buffer, {
                name: "rankcard.png"
            });

            await message.channel.send({ files: [attachment] });

            await loadingMsg.delete();

        } catch (error) {

            console.error("Gagal render Rank Card:", error);

            loadingMsg.edit("❌ Gagal memuat Rank Card.");

        }
    }
};
