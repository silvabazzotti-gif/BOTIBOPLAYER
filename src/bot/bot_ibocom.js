const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

async function executarIboCom(pedido, atualizarStatus) {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1600 });
        
        atualizarStatus(pedido.mac, "acessando_site", "Conectando ao portal IBO...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2', timeout: 60000 });

        // Aceitar Termos
        try {
            await page.waitForSelector('button.bg-main', { timeout: 10000 });
            await page.click('button.bg-main');
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            await page.evaluate(() => {
                document.querySelectorAll('.modal, .modal-backdrop').forEach(m => m.remove());
                document.body.classList.remove('modal-open');
            });
        }

        // Screenshot do Captcha
        const seletorForm = '#login-form, form';
        await page.waitForSelector(seletorForm, { visible: true, timeout: 20000 });
        const formElement = await page.$(seletorForm);
        const captchaBase64 = await formElement.screenshot({ encoding: 'base64', type: 'jpeg', quality: 80 });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Resolva o captcha:", {
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}`
        });

        let resolvido = false;
        let tempoInicio = Date.now();
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Autenticando...");

                // Preenchimento com nomes corretos: max-address e device-key
                await page.waitForSelector("input[name='max-address']", { visible: true });
                await page.type("input[name='max-address']", pedido.mac, { delay: 50 });
                
                if (pedido.key) {
                    await page.type("input[name='device-key']", pedido.key, { delay: 50 });
                }
                
                await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 50 });
                
                await Promise.all([
                    page.click("button[type='submit']"),
                    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
                ]);
                
                // CAPTURA DE COOKIES PARA O PRÓXIMO BOT
                const cookies = await page.cookies();
                atualizarStatus(pedido.mac, "ok", "✅ Logado com sucesso!", { cookies });
                resolvido = true;
            }
        }
    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Falha: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
