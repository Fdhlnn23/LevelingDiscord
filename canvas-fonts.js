const { GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
 
const FONT_DIR = path.join(__dirname, 'node_modules/@fontsource/inter/files');
 
let loaded = false;
 
function loadFonts() {
    if (loaded) return;
 
    try {
        GlobalFonts.registerFromPath(path.join(FONT_DIR, 'inter-latin-400-normal.woff'), 'Inter');
        GlobalFonts.registerFromPath(path.join(FONT_DIR, 'inter-latin-700-normal.woff'), 'Inter');
        GlobalFonts.registerFromPath(path.join(FONT_DIR, 'inter-latin-900-normal.woff'), 'Inter');
        loaded = true;
        console.log('✅ Font Inter berhasil dimuat dari node_modules.');
    } catch (e) {
        console.error('❌ Gagal memuat font Inter:', e.message);
        console.error('   Pastikan sudah: npm install @fontsource/inter');
    }
}
 
module.exports = { loadFonts };
