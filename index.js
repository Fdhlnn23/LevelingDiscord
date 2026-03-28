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

// --- DATABASE ---
const xpDbPath = './database/xp.json';
const settingsDbPath = './database/settings.json';

if (!fs.existsSync('./database')) fs.mkdirSync('./database');
if (!fs.existsSync(xpDbPath)) fs.writeFileSync(xpDbPath, JSON.stringify({}, null, 4));
if (!fs.existsSync(settingsDbPath)) fs.writeFileSync(settingsDbPath, JSON.stringify({}, null, 4));

function readDB(dbPath) {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDB(dbPath, data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 4));
}

// ==============================
// XP CACHE
// ==============================

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
}, 10000);

// --- CONFIG ---
const XP_PER_MESSAGE = 20;
const XP_PER_VOICE_TICK = 15;
const VOICE_XP_INTERVAL_MS = 10000;
const PREFIX = '?';

const XP_TO_LEVEL_UP = (level) => Math.floor(100 * Math.pow(level + 1, 1.8));

// ==============================
// LEVEL CARD RENDER (CANVAS)
// ==============================

async function renderLevelCard(member, level) {

    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext("2d");

    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const bgUrl = 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000&auto=format&fit=crop';

    const background = await loadImage(bgUrl);
    ctx.drawImage(background, 0, 0, 800, 250);

    // overlay blur style
    ctx.fillStyle = "rgba(15,23,42,0.7)";
    ctx.fillRect(40, 40, 720, 170);

    // avatar
    const avatar = await loadImage(avatarUrl);

    ctx.beginPath();
    ctx.arc(140, 125, 65, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(avatar, 75, 60, 130, 130);

    ctx.restore();

    // username
    ctx.font = "bold 42px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(member.user.username, 240, 120);

    // title
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("LEVEL UP!", 240, 80);

    // level
    ctx.font = "bold 32px sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`Level ${level}`, 240, 170);

    return canvas.encode("png");
}

// ==============================
// XP + LEVEL SYSTEM
// ==============================

async function addXpAndCheckLevelUp(guildId, userId, xpAmount, notifyTarget) {

    const dbKey = `${guildId}_${userId}`;
    const entry = getXpEntry(dbKey);

    entry.xp += xpAmount;
    xpCacheDirty = true;

    const xpNeeded = XP_TO_LEVEL_UP(entry.level);

    if (entry.xp < xpNeeded) return;

    entry.level += 1;
    entry.xp -= xpNeeded;
    xpCacheDirty = true;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    try {

        const buffer = await renderLevelCard(member, entry.level);

        const attachment = new AttachmentBuilder(buffer, {
            name: "levelup.png"
        });

        const settingsDb = readDB(settingsDbPath);
        const logChannelId = settingsDb[guildId]?.logChannel;

        if (logChannelId) {

            const logChannel = guild.channels.cache.get(logChannelId);

            if (logChannel) {
                return logChannel.send({
                    content: `🎉 Selamat <@${userId}>!`,
                    files: [attachment]
                });
            }
        }

        if (notifyTarget) {
            notifyTarget.send({
                content: `🎉 Selamat <@${userId}>, kamu naik level!`,
                files: [attachment]
            });
        }

    } catch (error) {
        console.error("Gagal render Rank Card:", error);
    }
}

// ==============================
// READY
// ==============================

client.on('ready', () => {

    console.log(`✅ Bot online sebagai ${client.user.tag}`);
    console.log(`✅ Berhasil memuat ${client.commands.size} commands.`);

    console.log('\n📊 Tabel XP per Level:');

    for (const lvl of [1,5,10,20,50,100]) {

        console.log(`Level ${lvl} → butuh ${XP_TO_LEVEL_UP(lvl).toLocaleString()} XP`);

    }

    let isVoiceTickRunning = false;

    setInterval(async () => {

        if (isVoiceTickRunning) return;

        isVoiceTickRunning = true;

        try {

            for (const guild of client.guilds.cache.values()) {

                const settingsDb = readDB(settingsDbPath);
                const logChannelId = settingsDb[guild.id]?.logChannel;

                const notifyChannel = logChannelId
                    ? guild.channels.cache.get(logChannelId)
                    : null;

                for (const [, voiceChannel] of guild.channels.cache) {

                    if (!voiceChannel.isVoiceBased()) continue;

                    for (const [, member] of voiceChannel.members) {

                        if (member.user.bot) continue;
                        if (member.voice.selfMute && member.voice.selfDeaf) continue;

                        await addXpAndCheckLevelUp(
                            guild.id,
                            member.user.id,
                            XP_PER_VOICE_TICK,
                            notifyChannel
                        );
                    }
                }
            }

        } finally {

            isVoiceTickRunning = false;

        }

    }, VOICE_XP_INTERVAL_MS);

});

// ==============================
// MESSAGE
// ==============================

client.on('messageCreate', async (message) => {

    if (message.author.bot || !message.guild) return;

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

    await addXpAndCheckLevelUp(
        message.guild.id,
        message.author.id,
        XP_PER_MESSAGE,
        message.channel
    );

});

client.login(process.env.TOKEN);
