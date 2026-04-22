const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

async function adicionarPlaylistIbo(pedido, atualizarStatus) {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1600 });
        
        // INJETA COOKIES DA SESSÃO ANTERIOR
        if (pedido.cookies) {
            await page.setCookie(...pedido.cookies);
        }

        atualizarStatus(pedido.mac, "adicionando_playlist", "Acessando gerenciador...");
        await page.goto('https://iboplayer.com/dashboard', { waitUntil: 'networkidle2', timeout: 60000 });

        // Clica em Add Playlist
        const btnAdd = "button.bg-main.text-white";
        await page.waitForSelector(btnAdd, { visible: true, timeout: 15000 });
        await page.click(btnAdd);
        
        await new Promise(r => setTimeout(r, 2000));

        // Preenche campos usando IDs extraídos
        await page.waitForSelector("#playlist-name", { visible: true, timeout: 15000 });
        await page.type("#playlist-name", pedido.nome_lista || "Lista IPTV", { delay: 50 });
        await page.type("#playlist-url", pedido.url_playlist, { delay: 50 });

        if (pedido.pin) {
            await page.click("div.border-\\[\\#B4B4B4\\]");
            await new Promise(r => setTimeout(r, 500));
            await page.type("#pin", pedido.pin);
            await page.type("#confirm-pin", pedido.pin);
        }

        // Botão SAVE
        const btnSave = "button[type='submit'].flex.ml-auto";
        await Promise.all([
            page.click(btnSave),
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
        ]);
        
        atualizarStatus(pedido.mac, "ok", "✅ Playlist adicionada com sucesso!");

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Erro na Playlist: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { adicionarPlaylistIbo };
