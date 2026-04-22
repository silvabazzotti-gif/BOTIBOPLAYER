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
        await page.setViewport({ width: 1280, height: 1600 });
        
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
                document.body.classList.remove('modal-open');
            });
        }

        // 2. CAPTURA DO FORMULÁRIO PARA PRINT
        const seletorForm = 'form'; 
        await page.waitForSelector(seletorForm, { visible: true, timeout: 20000 });
        const formElement = await page.$(seletorForm);
        const captchaBase64 = await formElement.screenshot({ encoding: 'base64', type: 'jpeg', quality: 80 });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código da imagem:", {
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}`
        });

        // Loop de espera até confirmar no seu painel
        while (!pedido.captchaDigitado) {
            await new Promise(r => setTimeout(r, 1000));
        }

        atualizarStatus(pedido.mac, "processando", "Autenticando...");

        // 3. PREENCHIMENTO POR POSIÇÃO (USANDO O PRINT COMO GUIA)
        await page.type("#max-address", pedido.mac, { delay: 50 });
        await page.type("#device-key", pedido.key, { delay: 50 });

        // Nova lógica: Procura o input que está acima do botão "Refresh Captcha"
        await page.evaluate((codigo) => {
            const inputs = Array.from(document.querySelectorAll('form input[type="text"]'));
            // No seu print, o captcha é o campo que não tem ID nem Name e está no final do form
            const refreshBtn = document.evaluate("//button[contains(., 'Refresh Captcha')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            
            let target;
            if (refreshBtn) {
                // Pega o input que está fisicamente antes do botão de refresh
                target = refreshBtn.parentElement.querySelector('input');
            }
            
            // Se não achar pelo botão, pega o último input de texto do formulário
            if (!target) {
                target = inputs[inputs.length - 1];
            }

            if (target) {
                target.focus();
                target.value = codigo;
                target.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, pedido.captchaDigitado);

        // 4. CLIQUE NO BOTÃO LOGIN (VERMELHO)
        await Promise.all([
            page.click("button[type='submit']"),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
        ]);

        if (page.url().includes("login")) {
            pedido.captchaDigitado = null;
            throw new Error("Dados ou Captcha incorretos.");
        }

        // 5. SE LOGOU, ADICIONA AS PLAYLISTS
        const servidores = dnsConfig.servidores || [];
        for (let i = 0; i < servidores.length; i++) {
            const urlM3u = `${servidores[i]}/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;
            atualizarStatus(pedido.mac, "processando", `Enviando DNS ${i + 1}...`);
            await adicionarDns(page, `Server ${i + 1}`, urlM3u);
        }

        atualizarStatus(pedido.mac, "ok", "✅ Configuração concluída!");

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Falha: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
