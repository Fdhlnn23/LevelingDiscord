const fs = require('fs');
const settingsDbPath = './database/settings.json';

function readDB(dbPath) { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); }
function writeDB(dbPath, data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 4)); }

module.exports = {
    name: 'setlog',
    description: 'Mengatur channel untuk notifikasi level up',
    async execute(message, args, client) {
        if (!message.member.permissions.has('ManageGuild')) {
            return message.reply('❌ Kamu tidak punya akses (Manage Server) untuk mengatur ini.');
        }

        const targetChannel = message.mentions.channels.first();
        if (!targetChannel) {
            return message.reply('Tag channel-nya, contoh: `!setlog #level-logs`');
        }

        const guildId = message.guild.id;
        let settingsDb = readDB(settingsDbPath);
        
        if (!settingsDb[guildId]) settingsDb[guildId] = {};
        settingsDb[guildId].logChannel = targetChannel.id;
        
        writeDB(settingsDbPath, settingsDb);
        return message.reply(`✅ Channel log level-up berhasil diatur ke ${targetChannel}`);
    }
};