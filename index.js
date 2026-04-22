const express = require('express');
const path = require('path');
const dnsConfig = require('./src/config/dns'); 
const { executarIboCom } = require('./src/bot/bot_ibocom');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];
let botOcupado = false;

function atualizarStatus(mac, status, mensagem, extras = {}) {
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.status = status;
        pedido.mensagem = mensagem;
        Object.assign(pedido, extras);
    }
}

app.post('/ativar', (req, res) => {
    const { mac } = req.body;
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = { 
        ...req.body, 
        status: 'pendente', 
        mensagem: 'Aguardando na fila...', 
        captchaDigitado: null 
    };
    
    pedidos.push(novoPedido);
    console.log(`[FILA] Pedido recebido: ${mac}`);
    res.json({ success: true });
});

app.post('/resolver-captcha', (req, res) => {
    const { mac, texto } = req.body;
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.captchaDigitado = texto;
        console.log(`[CAPTCHA] Resolvido para: ${mac}`);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Sessão não encontrada" });
    }
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    res.json(pedido || { status: "nao_encontrado" });
});

// Loop que processa a fila a cada 3 segundos
setInterval(async () => {
    if (botOcupado) return;
    const pedido = pedidos.find(p => p.status === "pendente");
    
    if (pedido) {
        botOcupado = true;
        try {
            await executarIboCom(pedido, atualizarStatus);
        } catch (e) {
            console.error("Erro no processamento:", e);
        } finally {
            botOcupado = false;
        }
    }
}, 3000);

app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
