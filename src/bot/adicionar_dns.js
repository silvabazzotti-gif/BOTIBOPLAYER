/**
 * Lógica para adicionar uma playlist DNS no painel do IBO Player
 */
module.exports = async (page, nome, url) => {
    try {
        // 1. Clica no botão "Add Playlist"
        const btnAdd = "button.bg-main.text-white";
        await page.waitForSelector(btnAdd, { visible: true, timeout: 10000 });
        await page.click(btnAdd);
        
        // Espera o modal abrir
        await new Promise(r => setTimeout(r, 2500));

        // 2. Preenche os campos usando os IDs que você já validou
        await page.waitForSelector("#playlist-name", { visible: true, timeout: 5000 });
        
        // Limpa e digita o nome
        await page.click("#playlist-name", { clickCount: 3 });
        await page.type("#playlist-name", nome, { delay: 50 });

        // Digita a URL M3U
        await page.click("#playlist-url", { clickCount: 3 });
        await page.type("#playlist-url", url, { delay: 20 });

        // 3. Clica no botão SAVE
        const btnSave = "button[type='submit'].flex.ml-auto";
        await page.click(btnSave);
        
        // 4. Aguarda o processamento do site (IBO demora uns segundos para salvar)
        await new Promise(r => setTimeout(r, 12000));
        
        // 5. Volta para o dashboard para limpar o estado e se preparar para a próxima
        await page.goto('https://iboplayer.com/dashboard', { waitUntil: 'networkidle2' });
        
        return true;
    } catch (error) {
        console.error(`Erro ao adicionar DNS ${nome}:`, error.message);
        return false;
    }
};
