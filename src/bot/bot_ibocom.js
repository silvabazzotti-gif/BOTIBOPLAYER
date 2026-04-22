const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const dnsConfig = require('../config/dns');
const adicionarDns = require('./adicionar_dns'); // Importa a função modular

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
        await page.setViewport({ width: 1280, height: 1600 });
        
        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2', timeout: 60000 });

        // 1. Aceitar Termos
        try {
            await page.waitForSelector('button.bg-main', { timeout: 10000 });
            await page.click('button.bg-main');
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            await page.evaluate(() => {
                document.querySelectorAll('.modal, .modal-backdrop').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
            });
        }

        // 2. Captura do Captcha
        const seletorForm = '#login-form, form'; 
        await page.waitForSelector(seletorForm, { timeout: 15000 });
        const formElement = await page.$(seletorForm);
        const captchaBase64 = await formElement.screenshot({ encoding: 'base64', type: 'jpeg' });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Resolva o captcha no painel", { 
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}` 
        });

        // Espera o cliente digitar no painel
        while (!pedido.captchaDigitado) {
            await new Promise(r => setTimeout(r, 2000));
        }

        // 3. Preenchimento e Login
        await page.type("#max-address", pedido.mac, { delay: 50 });
        await page.type("#device-key", pedido.key, { delay: 50 });
        await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 50 });

        await Promise.all([
            page.click("button[type='submit']"),
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
        ]);

        if (page.url().includes("login")) {
            throw new Error("Dados ou Captcha inválidos.");
        }

        // 4. Início do Loop de DNS (Chamando o módulo separado)
        const servidores = dnsConfig.servidores || [];
        for (let i = 0; i < servidores.length; i++) {
            const dns = servidores[i];
            const nomeLista = `Server ${i + 1}`;
            const urlM3u = `${dns}/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;

            atualizarStatus(pedido.mac, "processando", `Adicionando DNS ${i + 1} de ${servidores.length}...`);
            
            await adicionarDns(page, nomeLista, urlM3u);
        }

        atualizarStatus(pedido.mac, "ok", "✅ Todas as listas foram configuradas!");

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
