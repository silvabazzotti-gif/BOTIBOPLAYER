
/**
 * Verifica se a playlist já existe na conta do cliente
 */
module.exports = async (page, nomePlaylist) => {
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    
    const existe = await page.evaluate(nome => {
        return document.body.innerText.toUpperCase().includes(nome.toUpperCase());
    }, nomePlaylist);
    
    return existe;
};
