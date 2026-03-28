require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, Collection } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
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

// ── IN-MEMORY XP CACHE ──
let xpCache = readDB(xpDbPath);
let xpCacheDirty = false;

function getXpEntry(dbKey) {
    if (!xpCache[dbKey]) xpCache[dbKey] = { xp: 0, level: 0 };
    return xpCache[dbKey];
}

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

// ── HELPER: rounded rect ──
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

// ── RENDER LEVEL UP CARD ──
async function renderLevelUpCard(member, newLevel) {
    const W = 800, H = 250;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // WAJIB — tanpa ini teks tidak muncul
    ctx.textBaseline = 'alphabetic';

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0,   '#0f172a');
    bgGrad.addColorStop(0.5, '#1e1b4b');
    bgGrad.addColorStop(1,   '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Partikel dekoratif
    for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
    }

    // Card glass
    const cardX = 40, cardY = 35, cardW = 720, cardH = 180, cardR = 20;
    ctx.save();
    roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Avatar
    const avatarSize = 130;
    const avatarCX = cardX + 40 + avatarSize / 2;
    const avatarCY = cardY + cardH / 2;

    try {
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatarImg = await loadImage(avatarUrl);

        // Border lingkaran
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarCX, avatarCY, avatarSize / 2 + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
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
        ctx.arc(avatarCX, avatarCY, avatarSize / 2 + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(avatarCX, avatarCY, avatarSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#334155';
        ctx.fill();
        ctx.restore();
    }

    // Teks — textBaseline dipastikan ulang setelah save/restore
    const textX = avatarCX + avatarSize / 2 + 35;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign    = 'left';

    // Label "LEVEL UP!"
    ctx.font      = 'bold 15px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('LEVEL UP!', textX, cardY + 70);

    // Username
    ctx.font        = 'bold 42px sans-serif';
    ctx.fillStyle   = '#f8fafc';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur  = 6;
    ctx.fillText(member.user.username, textX, cardY + 120);
    ctx.shadowBlur  = 0;

    // Level
    ctx.font      = 'bold 32px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`Level ${newLevel}`, textX, cardY + 162);

    return canvas.toBuffer('image/png');
}

// ── TAMBAH XP + CEK LEVEL UP ──
async function addXpAndCheckLevelUp(guildId, userId, xpAmount, notifyTarget) {
    const dbKey = `${guildId}_${userId}`;
    const entry = getXpEntry(dbKey);

    entry.xp += xpAmount;
    xpCacheDirty = true;

    const xpNeeded = XP_TO_LEVEL_UP(entry.level);
    if (entry.xp < xpNeeded) return;

    entry.level += 1;
    entry.xp    -= xpNeeded;
    xpCacheDirty = true;

    const newLevel = entry.level;
    const guild    = client.guilds.cache.get(guildId);
    if (!guild) return;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    try {
        const imageBuffer = await renderLevelUpCard(member, newLevel);
        const attachment  = new AttachmentBuilder(imageBuffer, { name: 'levelup.png' });

        const settingsDb   = readDB(settingsDbPath);
        const logChannelId = settingsDb[guildId]?.logChannel;

        if (logChannelId) {
            const logChannel = guild.channels.cache.get(logChannelId);
            if (logChannel) return logChannel.send({ content: `🎉 Selamat <@${userId}>!`, files: [attachment] });
        }

        if (notifyTarget) {
            notifyTarget.send({ content: `🎉 Selamat <@${userId}>, kamu naik level!`, files: [attachment] });
        }
    } catch (error) {
        console.error('Gagal merender gambar level up:', error);
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

    let isVoiceTickRunning = false;
    setInterval(async () => {
        if (isVoiceTickRunning) return;
        isVoiceTickRunning = true;
        try {
            for (const guild of client.guilds.cache.values()) {
                const settingsDb   = readDB(settingsDbPath);
                const logChannelId = settingsDb[guild.id]?.logChannel;
                const notifyChannel = logChannelId ? guild.channels.cache.get(logChannelId) : null;

                for (const [, voiceChannel] of guild.channels.cache) {
                    if (!voiceChannel.isVoiceBased()) continue;
                    for (const [, member] of voiceChannel.members) {
                        if (member.user.bot) continue;
                        if (member.voice.selfMute && member.voice.selfDeaf) continue;
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

    if (message.content.startsWith(PREFIX)) {
        const args        = message.content.slice(PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command     = client.commands.get(commandName);
        if (!command) return;
        try {
            await command.execute(message, args, client);
        } catch (error) {
            console.error(error);
            message.reply('❌ Terjadi kesalahan saat menjalankan command ini!');
        }
        return;
    }

    await addXpAndCheckLevelUp(message.guild.id, message.author.id, XP_PER_MESSAGE, message.channel);
});

client.login(process.env.TOKEN);
