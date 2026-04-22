const express = require('express');
const path = require('path');

// IMPORTANTE: Ajuste o caminho para onde está o seu dns.js
// Pelas suas fotos, ele está em src/config/dns.js
const dnsConfig = require('./src/config/dns'); 

const enginePro = require('./src/bot/engine');      
const botIboCom = require('./src/bot/bot_ibocom'); 

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];
let botOcupado = false;

app.post('/ativar', (req, res) => {
    const { mac, key, user, pass, tipo } = req.body;
    
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    // CORREÇÃO AQUI: Verificando se dnsConfig e servidores existem antes de ler o length
    const listaServidores = (dnsConfig && dnsConfig.servidores) ? dnsConfig.servidores : [];

    const novoPedido = {
        mac, key, user, pass, tipo,
        status: "pendente",
        mensagem: "Aguardando na fila...",
        captchaBase64: null,
        captchaDigitado: null,
        indiceAtual: 0,
        total: listaServidores.length // Agora não dará erro de undefined
    };

    pedidos.push(novoPedido);
    res.json({ success: true });
});

app.post('/resolver-captcha', (req, res) => {
    const { mac, texto } = req.body;
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.captchaDigitado = texto;
        pedido.status = "pendente";
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Não encontrado" });
    }
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    res.json(pedido || { status: "nao_encontrado" });
});

setInterval(async () => {
    if (botOcupado) return;
    
    const pedido = pedidos.find(p => p.status === "pendente");
    if (!pedido) return;

    botOcupado = true;
    try {
        if (pedido.tipo === "ibopro") {
            await enginePro(pedidos); 
        } else if (pedido.tipo === "ibocom") {
            await botIboCom(pedido);  
        }
    } catch (e) {
        console.error("Erro no Bot:", e.message);
        pedido.status = "erro";
        pedido.mensagem = "Erro: " + e.message;
    } finally {
        botOcupado = false;
    }
}, 8000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor ativo na porta ${PORT}`));
