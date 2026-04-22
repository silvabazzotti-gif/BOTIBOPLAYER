/**
 * Realiza o login e confirma se a entrada foi bem-sucedida
 */
module.exports = async (page, mac, key) => {
    try {
        await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
        
        // Limpa e digita os campos
        await page.click("input[name='mac_address']", { clickCount: 3 });
        await page.type("input[name='mac_address']", mac);
        
        await page.click("input[name='password']", { clickCount: 3 });
        await page.type("input[name='password']", key);
        
        // Clica no botão de login
        await page.evaluate(() => {
            const btn = document.querySelector("button[type='submit']");
            if (btn) { 
                btn.disabled = false; 
                btn.click(); 
            }
        });
        
        // Aguarda a resposta do site
        await new Promise(r => setTimeout(r, 8000));

        // VERIFICAÇÃO: Se ainda estiver na página de login, o acesso foi negado
        const logado = await page.evaluate(() => {
            return !window.location.href.includes("login");
        });

        return logado;
    } catch (e) {
        console.log("Falha técnica no login:", e.message);
        return false;
    }
};
