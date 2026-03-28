require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, Collection } = require('discord.js');
const nodeHtmlToImage = require('node-html-to-image');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// --- INIT COMMAND HANDLER ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('name' in command && 'execute' in command) {
        client.commands.set(command.name, command);
    } else {
        console.log(`[WARNING] Command di ${filePath} tidak memiliki properti 'name' atau 'execute'.`);
    }
}

// --- KONFIGURASI DATABASE ---
const xpDbPath = './database/xp.json';
const settingsDbPath = './database/settings.json';
if (!fs.existsSync('./database')) fs.mkdirSync('./database');
if (!fs.existsSync(xpDbPath)) fs.writeFileSync(xpDbPath, JSON.stringify({}, null, 4));
if (!fs.existsSync(settingsDbPath)) fs.writeFileSync(settingsDbPath, JSON.stringify({}, null, 4));

function readDB(dbPath) { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); }
function writeDB(dbPath, data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 4)); }

// ==========================================
// IN-MEMORY XP CACHE
// Semua baca/tulis XP lewat sini, bukan langsung ke file.
// File JSON hanya di-sync tiap 10 detik sebagai backup.
// ==========================================
let xpCache = readDB(xpDbPath);
let xpCacheDirty = false;

function getXpEntry(dbKey) {
    if (!xpCache[dbKey]) xpCache[dbKey] = { xp: 0, level: 0 };
    return xpCache[dbKey];
}

// Flush cache ke file tiap 10 detik
setInterval(() => {
    if (!xpCacheDirty) return;
    writeDB(xpDbPath, xpCache);
    xpCacheDirty = false;
}, 10_000);

// --- KONFIGURASI XP ---
const XP_PER_MESSAGE = 20;
const XP_PER_VOICE_TICK = 15;
const VOICE_XP_INTERVAL_MS = 10000;
const PREFIX = '?';

const XP_TO_LEVEL_UP = (level) => Math.floor(100 * Math.pow(level + 1, 1.8));

// ==========================================
// HELPER: Tambah XP + cek level up
// Semua operasi pakai xpCache (in-memory), aman dari race condition
// ==========================================
async function addXpAndCheckLevelUp(guildId, userId, xpAmount, notifyTarget) {
    const dbKey = `${guildId}_${userId}`;
    const entry = getXpEntry(dbKey);

    entry.xp += xpAmount;
    xpCacheDirty = true;

    const xpNeeded = XP_TO_LEVEL_UP(entry.level);
    if (entry.xp < xpNeeded) return;

    // --- LEVEL UP! ---
    entry.level += 1;
    entry.xp -= xpNeeded;
    xpCacheDirty = true;

    const newLevel = entry.level;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const bgUrl = 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000&auto=format&fit=crop';

    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { width: 800px; height: 250px; margin: 0; font-family: 'Segoe UI', sans-serif; background-image: url('${bgUrl}'); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; }
            .card { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 30px; display: flex; align-items: center; width: 85%; height: 60%; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37); }
            .avatar { width: 130px; height: 130px; border-radius: 50%; border: 4px solid #38bdf8; object-fit: cover; }
            .info { margin-left: 35px; color: white; }
            .title { font-size: 20px; color: #94a3b8; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 5px; }
            .name { font-size: 42px; font-weight: 800; margin: 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); }
            .level { font-size: 32px; color: #38bdf8; font-weight: bold; margin-top: 5px; }
        </style>
    </head>
    <body>
        <div class="card">
            <img src="${avatarUrl}" class="avatar" />
            <div class="info">
                <div class="title">LEVEL UP!</div>
                <div class="name">${member.user.username}</div>
                <div class="level">Level ${newLevel}</div>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const imageBuffer = await nodeHtmlToImage({ html: htmlTemplate, transparent: true });
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'levelup.png' });

        const settingsDb = readDB(settingsDbPath);
        const logChannelId = settingsDb[guildId]?.logChannel;

        if (logChannelId) {
            const logChannel = guild.channels.cache.get(logChannelId);
            if (logChannel) return logChannel.send({ content: `🎉 Selamat <@${userId}>!`, files: [attachment] });
        }

        if (notifyTarget) {
            notifyTarget.send({ content: `🎉 Selamat <@${userId}>, kamu naik level!`, files: [attachment] });
        }
    } catch (error) {
        console.error("Gagal merender gambar level up:", error);
    }
}

client.on('ready', () => {
    console.log(`✅ Bot online sebagai ${client.user.tag}`);
    console.log(`✅ Berhasil memuat ${client.commands.size} commands.`);

    console.log('\n📊 Tabel XP per Level:');
    for (const lvl of [1, 5, 10, 20, 50, 100]) {
        console.log(`   Level ${lvl.toString().padStart(3)} → butuh ${XP_TO_LEVEL_UP(lvl).toLocaleString()} XP`);
    }
    console.log('');

    // ==========================================
    // VOICE XP INTERVAL
    // Flag isVoiceTickRunning mencegah tick overlap
    // kalau render gambar level up butuh waktu lama
    // ==========================================
    let isVoiceTickRunning = false;

    setInterval(async () => {
        if (isVoiceTickRunning) return;
        isVoiceTickRunning = true;

        try {
            for (const guild of client.guilds.cache.values()) {
                const settingsDb = readDB(settingsDbPath);
                const logChannelId = settingsDb[guild.id]?.logChannel;
                const notifyChannel = logChannelId ? guild.channels.cache.get(logChannelId) : null;

                for (const [, voiceChannel] of guild.channels.cache) {
                    if (!voiceChannel.isVoiceBased()) continue;

                    for (const [, member] of voiceChannel.members) {
                        if (member.user.bot) continue;
                        if (member.voice.selfMute && member.voice.selfDeaf) continue; // skip AFK

                        await addXpAndCheckLevelUp(guild.id, member.user.id, XP_PER_VOICE_TICK, notifyChannel);
                    }
                }
            }
        } finally {
            isVoiceTickRunning = false;
        }
    }, VOICE_XP_INTERVAL_MS);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // ==========================================
    // 1. EKSEKUSI COMMAND
    // ==========================================
    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = client.commands.get(commandName);
        if (!command) return;
        try {
            await command.execute(message, args, client);
        } catch (error) {
            console.error(error);
            message.reply('❌ Terjadi kesalahan saat menjalankan command ini!');
        }
        return;
    }

    // ==========================================
    // 2. SISTEM PASIF XP DARI CHAT
    // ==========================================
    await addXpAndCheckLevelUp(message.guild.id, message.author.id, XP_PER_MESSAGE, message.channel);
});

client.login(process.env.TOKEN);