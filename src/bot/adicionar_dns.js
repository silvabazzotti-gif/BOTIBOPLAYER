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

        // 2. Captura do Captcha para o seu painel
        const seletorForm = 'form'; 
        await page.waitForSelector(seletorForm, { timeout: 15000 });
        const formElement = await page.$(seletorForm);
        const captchaBase64 = await formElement.screenshot({ encoding: 'base64', type: 'jpeg', quality: 80 });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código da imagem:", { 
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}` 
        });

        // Loop de espera até você confirmar no seu site
        while (!pedido.captchaDigitado) {
            await new Promise(r => setTimeout(r, 1000));
        }

        atualizarStatus(pedido.mac, "processando", "Autenticando no IBO...");

        // 3. PREENCHIMENTO DOS CAMPOS (Baseado no seu código do input)
        // Preenche MAC e Device Key
        await page.type("input[placeholder*='Mac']", pedido.mac, { delay: 50 }).catch(() => {});
        await page.type("input[placeholder*='Key']", pedido.key, { delay: 50 }).catch(() => {});

        // Lógica para o campo de Captcha genérico <input type="text">
        await page.evaluate((codigo) => {
            // No IBO, geralmente o captcha é o 3º input de texto do form
            const inputs = Array.from(document.querySelectorAll('form input[type="text"]'));
            // Filtramos o que não tem nome ou id, que é o caso do seu captcha
            const target = inputs.find(i => !i.name && !i.id) || inputs[2]; 
            if (target) {
                target.focus();
                target.value = codigo;
                // Dispara evento de input para o site entender que foi preenchido
                target.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, pedido.captchaDigitado);

        // 4. Clique no Botão de Login (Vermelho)
        const btnLogin = "button.bg-main"; // Botão vermelho do print
        await Promise.all([
            page.click(btnLogin),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
        ]);

        if (page.url().includes("login")) {
            pedido.captchaDigitado = null;
            throw new Error("Login não efetuado. Verifique os dados ou o Captcha.");
        }

        // 5. Se logou, inicia a adição das listas
        const servidores = dnsConfig.servidores || [];
        for (let i = 0; i < servidores.length; i++) {
            const dns = servidores[i];
            const nome = `Servidor ${i + 1}`;
            const url = `${dns}/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;

            atualizarStatus(pedido.mac, "processando", `Adicionando lista ${i + 1} de ${servidores.length}...`);
            await adicionarDns(page, nome, url);
        }

        atualizarStatus(pedido.mac, "ok", "✅ Todas as listas foram adicionadas com sucesso!");

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Erro: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
