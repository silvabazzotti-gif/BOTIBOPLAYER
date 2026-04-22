/**
 * Abre o formulário e preenche o Nome e o Link M3U
 */
module.exports = async (page, nome, m3u) => {
    // Clica no botão "Add Playlist"
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button"))
                         .find(el => el.innerText.includes("Add Playlist"));
        if (btn) btn.click();
    });
    
    await new Promise(r => setTimeout(r, 4000));

    const inputs = await page.$$("input");
    if (inputs.length >= 2) {
        await inputs[0].type(nome, { delay: 50 });
        await inputs[1].type(m3u, { delay: 50 });
    }
};
