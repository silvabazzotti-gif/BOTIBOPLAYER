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

        // 2. CAPTURA DO CAPTCHA
        const formElement = await page.$('form');
        const captchaBase64 = await formElement.screenshot({ encoding: 'base64', type: 'jpeg', quality: 80 });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código da imagem:", {
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}`
        });

        while (!pedido.captchaDigitado) {
            await new Promise(r => setTimeout(r, 1000));
        }

        atualizarStatus(pedido.mac, "processando", "Autenticando...");

        // 3. PREENCHIMENTO (Limpando antes de digitar)
        await page.click("#max-address", { clickCount: 3 });
        await page.type("#max-address", pedido.mac, { delay: 30 });
        
        await page.click("#device-key", { clickCount: 3 });
        await page.type("#device-key", pedido.key, { delay: 30 });

        // Lógica para achar o input de captcha que está acima do botão Refresh
        await page.evaluate((codigo) => {
            const refreshBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Refresh'));
            let target;
            if (refreshBtn) {
                target = refreshBtn.parentElement.querySelector('input');
            }
            if (!target) {
                target = document.querySelectorAll('form input[type="text"]')[2];
            }

            if (target) {
                target.value = ""; // Limpa campo
                target.focus();
                target.value = codigo;
                // Dispara eventos para o site reconhecer a mudança
                ['input', 'change', 'blur'].forEach(ev => target.dispatchEvent(new Event(ev, { bubbles: true })));
            }
        }, pedido.captchaDigitado);

        // 4. CLIQUE NO LOGIN
        await Promise.all([
            page.evaluate(() => document.querySelector("button[type='submit']").click()),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
        ]);

        if (page.url().includes("login")) {
            pedido.captchaDigitado = null; // Reseta para permitir nova tentativa
            throw new Error("Dados ou Captcha incorretos. Tente novamente.");
        }

        // 5. ADICIONAR PLAYLISTS
        const servidores = dnsConfig.servidores || [];
        for (let i = 0; i < servidores.length; i++) {
            const urlM3u = `${servidores[i]}/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;
            atualizarStatus(pedido.mac, "processando", `Enviando DNS ${i + 1}...`);
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
