const express = require('express');
const path = require('path');
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
    pedidos.push({ ...req.body, status: 'pendente', mensagem: 'Na fila...', captchaDigitado: null });
    res.json({ success: true });
});

app.post('/resolver-captcha', (req, res) => {
    const { mac, texto } = req.body;
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.captchaDigitado = texto;
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Sessão não encontrada" });
    }
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    res.json(pedido || { status: 'nao_encontrado' });
});

setInterval(async () => {
    if (botOcupado) return;
    const pedido = pedidos.find(p => p.status === "pendente");
    if (pedido) {
        botOcupado = true;
        await executarIboCom(pedido, atualizarStatus).catch(err => console.error("Erro Fila:", err));
        botOcupado = false;
    }
}, 3000);

app.listen(port, '0.0.0.0', () => console.log(`🚀 Servidor na porta ${port}`));
