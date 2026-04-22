/**
 * Finaliza a operação clicando no botão de envio
 */
module.exports = async (page) => {
    await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]');
        if (btn) btn.click();
    });
    
    // Aguarda o processamento final do site
    await new Promise(r => setTimeout(r, 12000));
};
