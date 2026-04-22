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

        // 2. REFRESH E CAPTURA DO SVG (Conforme o código que você enviou)
        atualizarStatus(pedido.mac, "processando", "Gerando novo Captcha...");
        try {
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Refresh'));
                if (btn) btn.click();
            });
            await new Promise(r => setTimeout(r, 2500)); 
        } catch (e) {}

        // Busca o elemento SVG para o print focado
        const svgElement = await page.$('svg'); 
        let captchaBase64 = "";

        if (svgElement) {
            // Tiramos o print da div que contém o SVG e o input
            const container = await page.evaluateHandle(el => el.closest('div'), svgElement);
            captchaBase64 = await container.asElement().screenshot({ encoding: 'base64', type: 'jpeg' });
        } else {
            // Fallback para o formulário todo
            const form = await page.$('form');
            captchaBase64 = await form.screenshot({ encoding: 'base64', type: 'jpeg' });
        }

        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código do desenho:", {
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}`
        });

        while (!pedido.captchaDigitado) {
            await new Promise(r => setTimeout(r, 1000));
        }

        // 3. PREENCHIMENTO FINAL
        atualizarStatus(pedido.mac, "processando", "Entrando no painel...");
        
        // Preenche campos fixos
        await page.type("#max-address", pedido.mac, { delay: 30 });
        await page.type("#device-key", pedido.key, { delay: 30 });

        // Preenche o campo de texto que você localizou acima do Refresh
        await page.evaluate((codigo) => {
            const svg = document.querySelector('svg');
            const container = svg.closest('div');
            const input = container.querySelector('input[type="text"]');
            
            if (input) {
                input.focus();
                input.value = codigo;
                ['input', 'change'].forEach(ev => input.dispatchEvent(new Event(ev, { bubbles: true })));
            }
        }, pedido.captchaDigitado);

        // 4. CLIQUE NO BOTÃO LOGIN
        await Promise.all([
            page.evaluate(() => {
                const btnLogin = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('LOGIN'));
                if (btnLogin) btnLogin.click();
            }),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
        ]);

        if (page.url().includes("login")) {
            pedido.captchaDigitado = null;
            throw new Error("Captcha ou dados inválidos. Tente novamente.");
        }

        // 5. ADIÇÃO DAS PLAYLISTS (Mesma lógica de antes)
        const servidores = dnsConfig.servidores || [];
        for (let i = 0; i < servidores.length; i++) {
            const urlM3u = `${servidores[i]}/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;
            atualizarStatus(pedido.mac, "processando", `Configurando DNS ${i + 1}...`);
            await adicionarDns(page, `Server ${i + 1}`, urlM3u);
        }

        atualizarStatus(pedido.mac, "ok", "✅ Sucesso! Playlists configuradas.");

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Falha: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
