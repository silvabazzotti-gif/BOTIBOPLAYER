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

        // --- REFRESH NO CAPTCHA PARA GARANTIR VALIDADE ---
        try {
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Refresh'));
                if (btn) btn.click();
            });
            await new Promise(r => setTimeout(r, 2500)); 
        } catch (e) {}

        // 2. PRINT APENAS DA ÁREA DO CAPTCHA (Otimizado)
        // No IBO, a imagem e o input geralmente estão dentro de uma div específica
        let captchaBase64 = "";
        try {
            // Tentamos capturar a div que contém a imagem do captcha
            const areaCaptcha = await page.$('img[src*="captcha"]').then(img => img.getProperty('parentElement')).then(div => div.asElement());
            if (areaCaptcha) {
                captchaBase64 = await areaCaptcha.screenshot({ encoding: 'base64', type: 'jpeg' });
            } else {
                // Fallback para o form caso não ache a div
                const form = await page.$('form');
                captchaBase64 = await form.screenshot({ encoding: 'base64', type: 'jpeg' });
            }
        } catch (e) {
            console.log("Erro ao focar print, tirando da página toda.");
            captchaBase64 = await page.screenshot({ encoding: 'base64', type: 'jpeg' });
        }

        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código abaixo:", {
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}`
        });

        while (!pedido.captchaDigitado) {
            await new Promise(r => setTimeout(r, 1000));
        }

        // 3. PREENCHIMENTO E LOGIN
        atualizarStatus(pedido.mac, "processando", "Autenticando...");
        await page.type("#max-address", pedido.mac, { delay: 40 });
        await page.type("#device-key", pedido.key, { delay: 40 });

        await page.evaluate((codigo) => {
            const refreshBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Refresh'));
            const target = refreshBtn ? refreshBtn.parentElement.querySelector('input') : document.querySelectorAll('form input[type="text"]')[2];
            if (target) {
                target.focus();
                target.value = codigo;
                ['input', 'change'].forEach(ev => target.dispatchEvent(new Event(ev, { bubbles: true })));
            }
        }, pedido.captchaDigitado);

        await Promise.all([
            page.evaluate(() => document.querySelector("button[type='submit']").click()),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
        ]);

        if (page.url().includes("login")) {
            pedido.captchaDigitado = null;
            throw new Error("Dados ou Captcha incorretos.");
        }

        // 4. ADICIONAR PLAYLISTS
        const servidores = dnsConfig.servidores || [];
        for (let i = 0; i < servidores.length; i++) {
            const urlM3u = `${servidores[i]}/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;
            atualizarStatus(pedido.mac, "processando", `DNS ${i + 1} de ${servidores.length}...`);
            await adicionarDns(page, `Server ${i + 1}`, urlM3u);
        }

        atualizarStatus(pedido.mac, "ok", "✅ Finalizado com sucesso!");

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Falha: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
