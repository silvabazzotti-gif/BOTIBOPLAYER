/**
 * Ativa a proteção por PIN e preenche os campos de senha
 */
module.exports = async (page, pin) => {
    // Ativa o checkbox de proteção
    await page.evaluate(() => {
        const check = document.querySelector('input[type="checkbox"]');
        if (check) check.click();
    });
    
    await new Promise(r => setTimeout(r, 2000));

    // Preenche o PIN e a Confirmação do PIN (índices 3 e 4 no formulário)
    const inputs = await page.$$("input");
    if (inputs.length >= 5) {
        await inputs[3].type(pin, { delay: 100 });
        await inputs[4].type(pin, { delay: 100 });
    }
};
