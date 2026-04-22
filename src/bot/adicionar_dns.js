module.exports = async (page, nome, m3u) => {
    try {
        const btnAdd = "button.bg-main.text-white";
        await page.waitForSelector(btnAdd, { visible: true, timeout: 15000 });
        await page.click(btnAdd);
        
        await new Promise(r => setTimeout(r, 2500));
        await page.waitForSelector("#playlist-name", { visible: true, timeout: 10000 });
        
        await page.click("#playlist-name", { clickCount: 3 });
        await page.type("#playlist-name", nome, { delay: 40 });

        await page.click("#playlist-url", { clickCount: 3 });
        await page.type("#playlist-url", m3u, { delay: 20 });

        await page.click("button[type='submit'].flex.ml-auto");
        
        await new Promise(r => setTimeout(r, 12000));
        await page.goto('https://iboplayer.com/dashboard', { waitUntil: 'networkidle2' });
        
        return true;
    } catch (error) {
        console.error(`Erro no DNS ${nome}:`, error.message);
        return false;
    }
};
