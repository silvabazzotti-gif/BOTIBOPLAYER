const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const dnsConfig = require('../config/dns');
const adicionarDns = require('./adicionar_dns');

async function executarIboCom(pedido, atualizarStatus) {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2', timeout: 60000 });

        // 1. ACEITAR TERMOS
        try {
            await page.waitForSelector('button.bg-main', { timeout: 10000 });
            await page.click('button.bg-main');
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            await page.evaluate(() => {
                document.querySelectorAll('.modal, .modal-backdrop').forEach(el => el.remove());
            });
        }

        // --- SUA ESTRATÉGIA: REFRESH NO CAPTCHA ---
        atualizarStatus(pedido.mac, "processando", "Atualizando Captcha para garantir validade...");
        try {
            // Procura o botão de refresh pelo texto conforme seu print
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Refresh'));
                if (btn) btn.click();
            });
            // Espera 3 segundos para a nova imagem carregar
            await new Promise(r => setTimeout(r, 3000)); 
        } catch (e) {
            console.log("Erro ao dar refresh, seguindo com o original");
        }

        // 2. CAPTURA DO NOVO CAPTCHA
        const formElement = await page.$('form');
        const captchaBase64 = await formElement.screenshot({ encoding: 'base64', type: 'jpeg', quality: 80 });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o NOVO código:", {
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}`
        });

        while (!pedido.captchaDigitado) {
            await new Promise(r => setTimeout(r, 1000));
        }

        atualizarStatus(pedido.mac, "processando", "Autenticando...");

        // 3. PREENCHIMENTO (MAC, KEY e CAPTCHA)
        await page.click("#max-address", { clickCount: 3 });
        await page.type("#max-address", pedido.mac, { delay: 40 });
        
        await page.click("#device-key", { clickCount: 3 });
        await page.type("#device-key", pedido.key, { delay: 40 });

        await page.evaluate((codigo) => {
            const refreshBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Refresh'));
            const target = refreshBtn ? refreshBtn.parentElement.querySelector('input') : document.querySelectorAll('form input[type="text"]')[2];

            if (target) {
                target.value = "";
                target.focus();
                target.value = codigo;
                ['input', 'change', 'blur'].forEach(ev => target.dispatchEvent(new Event(ev, { bubbles: true })));
            }
        }, pedido.captchaDigitado);

        // 4. LOGIN
        await Promise.all([
            page.evaluate(() => document.querySelector("button[type='submit']").click()),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
        ]);

        if (page.url().includes("login")) {
            pedido.captchaDigitado = null;
            throw new Error("Falha no login. Verifique o código e tente novamente.");
        }

        // 5. ADICIONAR PLAYLISTS (O Loop de 15 DNS)
        const servidores = dnsConfig.servidores || [];
        for (let i = 0; i < servidores.length; i++) {
            const urlM3u = `${servidores[i]}/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;
            atualizarStatus(pedido.mac, "processando", `DNS ${i + 1} de ${servidores.length}...`);
            await adicionarDns(page, `Server ${i + 1}`, urlM3u);
        }

        atualizarStatus(pedido.mac, "ok", "✅ Todas as listas foram configuradas!");

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Erro: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
