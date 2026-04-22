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
        
        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2', timeout: 60000 });

        // 1. ACEITAR TERMOS (Usando a classe que você encontrou)
        try {
            const seletorBotao = 'button.bg-main';
            await page.waitForSelector(seletorBotao, { timeout: 10000 });
            await page.click(seletorBotao);
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            await page.evaluate(() => {
                document.querySelectorAll('.modal, .modal-backdrop').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
            });
        }

        // 2. CAPTURA DO FORMULÁRIO PARA PRINT
        const seletorForm = '#login-form, form'; 
        await page.waitForSelector(seletorForm, { visible: true, timeout: 20000 });
        const formElement = await page.$(seletorForm);
        
        await formElement.scrollIntoView();
        const captchaBase64 = await formElement.screenshot({ 
            encoding: 'base64', 
            type: 'jpeg', 
            quality: 80 
        });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código da imagem:", {
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}`
        });

        // 3. PREENCHIMENTO DOS CAMPOS COM OS NOMES REAIS
        let resolvido = false;
        let tempoInicio = Date.now();
        
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Enviando dados...");

                // Preenche MAC e KEY (Nomes confirmados por você)
                await page.waitForSelector("input[name='max-address']", { visible: true, timeout: 10000 });
                await page.type("input[name='max-address']", pedido.mac, { delay: 50 });
                
                if (pedido.key) {
                    await page.type("input[name='device-key']", pedido.key, { delay: 50 });
                }
                
                // --- NOVA LÓGICA PARA O CAMPO DO CAPTCHA ---
                // Vamos tentar preencher qualquer campo que pareça ser o do captcha
                await page.evaluate((valor) => {
                    const inputs = Array.from(document.querySelectorAll('input'));
                    // Procura por ID ou Name que contenha 'captcha'
                    const target = inputs.find(i => 
                        i.name.toLowerCase().includes('captcha') || 
                        i.id.toLowerCase().includes('captcha') ||
                        i.placeholder?.toLowerCase().includes('captcha')
                    );
                    if (target) {
                        target.focus();
                        target.value = valor;
                    }
                }, pedido.captchaDigitado);

                // Tentativa direta via seletor comum do IBO
                try {
                    await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 50 });
                } catch (e) {
                    // Se falhar, tenta pelo name que costuma aparecer em scripts de captcha
                    await page.type("input[name='default_real_captcha']", pedido.captchaDigitado, { delay: 50 }).catch(() => {});
                }
                
                // Clique final no botão de Login
                await Promise.all([
                    page.click("button[type='submit']"),
                    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
                ]);
                
                atualizarStatus(pedido.mac, "ok", "✅ Logado com sucesso!");
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
