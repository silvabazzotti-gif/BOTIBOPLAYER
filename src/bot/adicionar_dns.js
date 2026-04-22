/**
 * Adiciona uma playlist individual e retorna ao dashboard
 */
module.exports = async (page, nome, m3u) => {
    try {
        // Clica no botão Add Playlist
        const btnAdd = "button.bg-main.text-white";
        await page.waitForSelector(btnAdd, { visible: true, timeout: 15000 });
        await page.click(btnAdd);
        
        await new Promise(r => setTimeout(r, 2000));

        // Preenche o formulário usando os IDs do .com
        await page.waitForSelector("#playlist-name", { visible: true, timeout: 10000 });
        
        await page.click("#playlist-name", { clickCount: 3 });
        await page.type("#playlist-name", nome, { delay: 40 });

        await page.click("#playlist-url", { clickCount: 3 });
        await page.type("#playlist-url", m3u, { delay: 20 });

        // Clica em Save
        const btnSave = "button[type='submit'].flex.ml-auto";
        await page.click(btnSave);
        
        // Aguarda o site salvar e recarrega para limpar o estado
        await new Promise(r => setTimeout(r, 12000));
        await page.goto('https://iboplayer.com/dashboard', { waitUntil: 'networkidle2' });
        
        return true;
    } catch (error) {
        console.error(`Falha ao adicionar ${nome}:`, error.message);
        return false;
    }
};
